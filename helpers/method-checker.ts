import { defaultAbiCoder } from '@ethersproject/abi';
import { Signer } from '@ethersproject/abstract-signer';
import { Contract } from '@ethersproject/contracts';
import { eContractid, ProtocolErrors } from './types';

export type FunctionAccessExceptions = { [key: string]: string | true | { args: any[]; reason?: string } };
export type ContractAccessExceptions = {
  functions: FunctionAccessExceptions;
  reasons?: string[];
};

const uniswapAdapter: ContractAccessExceptions = {
  functions: {
    executeOperation: 'CALLER_MUST_BE_LENDING_POOL',
    sweepToken: ProtocolErrors.CT_CALLER_MUST_BE_SWEEP_ADMIN,
    swapAndRepay: true,
    swapAndDeposit: true,
  },
};

const externalStrategy: ContractAccessExceptions = {
  functions: {
    delegatedWithdrawUnderlying: true,
    getDelegatedState: true,
  },
};

const DEFAULT_EXCEPTIONS: { [name: string]: ContractAccessExceptions } = {
  [eContractid.AddressesProviderRegistry]: {
    functions: {
      renounceOneTimeRegistrar: true,
    },
  },
  [eContractid.MarketAccessController]: {
    functions: {
      createProxy: true,
      renounceTemporaryAdmin: true,
    },
  },

  [eContractid.UniswapLiquiditySwapAdapter]: uniswapAdapter,
  [eContractid.UniswapRepayAdapter]: uniswapAdapter,
  [eContractid.FlashLiquidationAdapter]: uniswapAdapter,

  [eContractid.WETHGateway]: {
    functions: {
      depositETH: true,
      withdrawETH: true,
      borrowETH: true,
      repayETH: true,
      sweepToken: ProtocolErrors.CT_CALLER_MUST_BE_SWEEP_ADMIN,
    },
  },

  [eContractid.DelegatedStrategyAave]: externalStrategy,
  [eContractid.DelegatedStrategyCompoundErc20]: externalStrategy,
  [eContractid.DelegatedStrategyCompoundEth]: externalStrategy,

  [eContractid.TeamRewardPool]: {
    functions: {},
    reasons: [
      ProtocolErrors.RW_NOT_REWARD_CONTROLLER,
      ProtocolErrors.RW_NOT_REWARD_RATE_ADMIN,
      ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
      ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN,
      ProtocolErrors.RW_NOT_TEAM_MANAGER,
    ],
  },

  [eContractid.TreasuryRewardPool]: {
    functions: {},
    reasons: [
      ProtocolErrors.RW_NOT_REWARD_CONTROLLER,
      ProtocolErrors.RW_NOT_REWARD_RATE_ADMIN,
      ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
      ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN,
    ],
  },
};

export const verifyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: eContractid,
  checkAll?: boolean
) => {
  await _verifyMutableAccess(
    signer,
    contract,
    name,
    DEFAULT_EXCEPTIONS[name]?.functions,
    DEFAULT_EXCEPTIONS[name]?.reasons,
    checkAll
  );
};

const _verifyMutableAccess = async (
  signer: Signer,
  contract: Contract,
  name: string,
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
    console.log(fnName, args);
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

      let reason: string;
      if (message === prefixNoReason) {
        reason = '\n';
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
