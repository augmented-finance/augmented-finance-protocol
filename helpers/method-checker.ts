import { defaultAbiCoder } from '@ethersproject/abi';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { exit } from 'process';
import { FunctionAccessExceptions, getContractAccessExceptions } from './contracts-access';
import { eContractid, ProtocolErrors } from './types';

export const verifyContractMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: eContractid,
  estimateGas: boolean,
  checkAll: boolean
) => {
  const exceptions = getContractAccessExceptions(name);
  const isImpl = exceptions?.implOverride != undefined;
  const functions = isImpl ? { ...exceptions.functions, ...exceptions.implOverride! } : exceptions?.functions;
  await _verifyMutableAccess(signer, contract, name, isImpl, estimateGas, functions, exceptions?.reasons, checkAll);
};

export const verifyProxyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: eContractid,
  estimateGas: boolean,
  checkAll: boolean
) => {
  const exceptions = getContractAccessExceptions(name);
  await _verifyMutableAccess(
    signer,
    contract,
    name,
    false,
    estimateGas,
    exceptions?.functions,
    exceptions?.reasons,
    checkAll
  );
};

const _verifyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: string,
  isImpl: boolean,
  estimateGas: boolean,
  exceptions?: FunctionAccessExceptions,
  expected?: string[],
  checkAll?: boolean
) => {
  const DEFAULT_REVERTS = [
    ProtocolErrors.TXT_ACCESS_RESTRICTED,
    ProtocolErrors.TXT_OWNABLE_CALLER_NOT_OWNER,
    ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
  ];

  const expectedReverts = new Set<string>(expected ? expected : DEFAULT_REVERTS);

  let hasErrors = false;

  const reportError = (error, fnName: string, args) => {
    console.log(`${name}.${fnName}`, args);
    console.error(error);
    hasErrors = true;
    if (!checkAll) {
      throw error;
    }
  };

  contract = contract.connect(signer);
  for (const [fnName, fnDesc] of Object.entries(contract.interface.functions)) {
    if (fnDesc.stateMutability == 'pure' || fnDesc.stateMutability == 'view') {
      continue;
    }

    let exception = exceptions ? exceptions[fnName] : undefined;
    if (exception == undefined && exceptions) {
      exception = exceptions[fnName.substring(0, fnName.indexOf('('))];
    }

    const args = typeof exception == 'object' ? exception.args : defaultAbiCoder.getDefaultValue(fnDesc.inputs);
    if (typeof exception == 'object') {
      exception = exception.reason;
    }

    if (exception === true) {
      continue;
    }

    const reasonUnknown = '<<MISSING>>';
    const handleError = (error, message: string | undefined, hasReason: boolean) => {
      if (message === undefined) {
        reportError(error, fnName, args);
        return;
      }

      message = message.trim();
      const reasonNullCall = 'function call to a non-contract account';
      const reasonBrokenRedirect = "function selector was not recognized and there's no fallback function";

      if (hasReason) {
        if ((exception == undefined && expectedReverts.has(message)) || exception === message) {
          return;
        }
      } else if (isImpl) {
        if (message === reasonNullCall || message === reasonBrokenRedirect || message === reasonUnknown) {
          return;
        }
      }
      reportError(error, fnName, args);
    };

    const substringAfter = (s: string, m: string, doUnquote?: boolean): string | undefined => {
      const pos = s.indexOf(m);
      if (pos < 0) {
        return undefined;
      }
      if (doUnquote) {
        return unquote(s.substring(pos + m.length - 1));
      }
      return s.substring(pos + m.length);
    };

    try {
      await contract.callStatic[fnName](...args, {
        gasLimit: estimateGas ? (await contract.estimateGas[fnName](...args)).add(100000) : undefined,
      });
    } catch (error) {
      const message: string = error.message;

      if (error.method === 'estimateGas') {
        const prefixProviderReverted = 'execution reverted: ';
        const prefixProviderRevertedNoReason = 'execution reverted';

        let reason: string | undefined;
        if ((reason = substringAfter(error.error.message, prefixProviderReverted)) !== undefined) {
          // console.log('00', reason);
          handleError(error, reason, true);
        } else if (error.error.message.indexOf(prefixProviderRevertedNoReason) != 0) {
          // console.log('01');
          handleError(error, reasonUnknown, false);
        }
        continue;
      }

      // VM Exception while processing transaction: reverted with reason string '90'
      const prefixReasonStr = "VM Exception while processing transaction: reverted with reason string '";
      const prefixNoReason = 'Transaction reverted without a reason string';
      const prefixReverted = 'Transaction reverted: ';

      if (message === prefixNoReason) {
        // console.log('1');
        handleError(error, '', true);
        continue;
      }

      let reason: string | undefined;
      if (isImpl && (reason = substringAfter(message, prefixReverted)) !== undefined) {
        // console.log('2', reason);
        handleError(error, reason, false);
      } else {
        reason = substringAfter(message, prefixReasonStr, true);
        // console.log('3', reason);
        handleError(error, reason, true);
      }
      continue;
    }
    reportError(new Error(`Mutable function is accessible: ${name}.${fnName}`), fnName, args);
  }

  if (hasErrors) {
    throw new Error('Access errors were found for ' + name);
  }
};

const unquote = (s: string): string => {
  var quote = s[0];
  var single = quote === "'";
  return s
    .substring(1, s.length - 1)
    .replace(/\\\\/g, '\\')
    .replace(single ? /\\'/g : /\\"/g, quote);
};
