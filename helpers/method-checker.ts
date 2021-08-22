import { defaultAbiCoder } from '@ethersproject/abi';
import { Signer } from '@ethersproject/abstract-signer';
import { Contract } from '@ethersproject/contracts';
import { FunctionAccessExceptions, getContractAccessExceptions } from './contracts-access';
import { eContractid, ProtocolErrors } from './types';

export const verifyContractMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: eContractid,
  checkAll?: boolean
) => {
  const exceptions = getContractAccessExceptions(name);
  const isImpl = exceptions?.implOverride != undefined;
  const functions = isImpl ? { ...exceptions.functions, ...exceptions.implOverride! } : exceptions?.functions;
  await _verifyMutableAccess(signer, contract, name, isImpl, functions, exceptions?.reasons, checkAll);
};

export const verifyProxyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: eContractid,
  checkAll?: boolean
) => {
  const exceptions = getContractAccessExceptions(name);
  await _verifyMutableAccess(signer, contract, name, false, exceptions?.functions, exceptions?.reasons, checkAll);
};

const _verifyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: string,
  isImpl: boolean,
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

    try {
      await contract.callStatic[fnName](...args);
    } catch (error) {
      const message = error.message;
      // VM Exception while processing transaction: reverted with reason string '90'
      const prefixReasonStr = "VM Exception while processing transaction: reverted with reason string '";
      const prefixNoReason = 'Transaction reverted without a reason string';

      const prefixNullCall = 'Transaction reverted: function call to a non-contract account';
      const prefixBrokenRedirect =
        "Transaction reverted: function selector was not recognized and there's no fallback function";

      let reason: string;
      if (message === prefixNoReason) {
        reason = '\n';
      } else if (isImpl && (message === prefixNullCall || message === prefixBrokenRedirect)) {
        continue;
      } else {
        let pos: number;
        if ((pos = message.indexOf(prefixReasonStr)) >= 0) {
          reason = unquote(message.substring(pos + prefixReasonStr.length - 1));
        } else {
          reportError(error, fnName, args);
          continue;
        }
      }
      if ((exception == undefined && expectedReverts.has(reason)) || exception === reason) {
        continue;
      }
      reportError(error, fnName, args);
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
