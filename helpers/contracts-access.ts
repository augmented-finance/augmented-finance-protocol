import { eContractid, ProtocolErrors } from './types';

export type FunctionAccessExceptions = { [key: string]: string | true | { args: any[]; reason?: string } };
export type ContractAccessExceptions = {
  implOverride?: FunctionAccessExceptions;
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

const rewardPool: ContractAccessExceptions = {
  reasons: [
    ProtocolErrors.RW_NOT_REWARD_CONTROLLER,
    ProtocolErrors.RW_NOT_REWARD_RATE_ADMIN,
    ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN,
  ],
  functions: {
    setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
    handleScaledBalanceUpdate: 'unknown reward provider',
    handleBalanceUpdate: 'unknown reward provider',
  },
};

const erc20: ContractAccessExceptions = {
  functions: {
    approve: true,
    transfer: true,
    transferFrom: true,
    permit: true,
    increaseAllowance: true,
    decreaseAllowance: true,
  },
};

const rewardPoolImpl: ContractAccessExceptions = {
  ...rewardPool,
  implOverride: {
    initialize: 'initializer blocked',
  },
};

const poolTokenImpl: ContractAccessExceptions = {
  reasons: [
    ProtocolErrors.CT_CALLER_MUST_BE_LENDING_POOL,
    ProtocolErrors.RW_NOT_REWARD_CONTROLLER,
    ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN,
  ],
  functions: {
    setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
    initialize: 'already initialized',
  },
  implOverride: {
    initialize: 'initializer blocked',
  },
};

const poolDebtTokenImpl: ContractAccessExceptions = {
  ...poolTokenImpl,
  functions: {
    ...poolTokenImpl.functions,
    approveDelegation: true,
  },
};

const DEFAULT_EXCEPTIONS: { [name: string]: ContractAccessExceptions } = {
  [eContractid.AddressesProviderRegistry]: {
    functions: {
      renounceOneTimeRegistrar: true,
      acceptOwnership: 'SafeOwnable: caller is not the pending owner',
      recoverOwnership: 'SafeOwnable: caller can not recover ownership',
    },
  },
  [eContractid.MarketAccessController]: {
    functions: {
      createProxy: true,
      renounceTemporaryAdmin: true,
      acceptOwnership: 'SafeOwnable: caller is not the pending owner',
      recoverOwnership: 'SafeOwnable: caller can not recover ownership',
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
    functions: {
      setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
    },
    reasons: [...rewardPool.reasons!, ProtocolErrors.RW_NOT_TEAM_MANAGER],
  },

  [eContractid.TreasuryRewardPool]: {
    functions: {
      setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
    },
    reasons: rewardPool.reasons,
  },

  [eContractid.PermitFreezerRewardPool]: {
    functions: {
      claimRewardByPermit: true,
      setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
    },
    reasons: rewardPool.reasons,
  },

  [eContractid.LendingPoolImpl]: {
    functions: {
      deposit: true,
      withdraw: true,
      borrow: true,
      repay: true,
      finalizeTransfer: ProtocolErrors.LP_CALLER_MUST_BE_DEPOSIT_TOKEN,
      flashLoan: true,
      liquidationCall: true,
      rebalanceStableBorrowRate: true,
      setUserUseReserveAsCollateral: true,
      swapBorrowRateMode: true,
      setLendingPoolExtension: ProtocolErrors.CALLER_NOT_POOL_ADMIN,
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.LendingPoolExtensionImpl]: {
    functions: {
      borrow: true,
      flashLoan: true,
      liquidationCall: true,
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.LendingPoolConfiguratorImpl]: {
    reasons: [ProtocolErrors.CALLER_NOT_POOL_ADMIN],
    functions: {
      setPausedFor: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.TreasuryImpl]: {
    functions: {
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.StableDebtTokenImpl]: poolDebtTokenImpl,
  [eContractid.VariableDebtTokenImpl]: poolDebtTokenImpl,

  [eContractid.DepositTokenImpl]: {
    ...poolTokenImpl,
    functions: {
      ...poolTokenImpl.functions,
      ...erc20.functions,

      provideSubBalance: ProtocolErrors.AT_CALLER_NOT_SUB_BALANCE_OPERATOR,
      returnSubBalance: ProtocolErrors.AT_CALLER_NOT_SUB_BALANCE_OPERATOR,
      updateTreasury: ProtocolErrors.CALLER_NOT_POOL_ADMIN,
    },
  },

  [eContractid.StakeConfiguratorImpl]: {
    functions: {
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.StakeTokenImpl]: {
    functions: {
      ...erc20.functions,
      stake: true,
      redeem: true,
      redeemUnderlying: true,
      cooldown: true,
      setIncentivesController: ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN,
      initializeStakeToken: 'already initialized',
      initialize: 'already initialized',
    },
    implOverride: {
      initializeStakeToken: 'initializer blocked',
      initialize: 'initializer blocked',
    },
  },

  [eContractid.RewardConfiguratorImpl]: {
    reasons: [ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN, ProtocolErrors.RW_NOT_REWARD_RATE_ADMIN],
    functions: {
      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.AGFTokenV1Impl]: {
    functions: {
      ...erc20.functions,

      initializeRewardToken: 'already initialized',
      initialize: 'already initialized',
    },
    implOverride: {
      initializeRewardToken: 'initializer blocked',
      initialize: 'initializer blocked',
    },
  },

  [eContractid.RewardBoosterImpl]: {
    reasons: [ProtocolErrors.RW_NOT_REWARD_RATE_ADMIN, ProtocolErrors.CT_CALLER_MUST_BE_REWARD_ADMIN],
    functions: {
      claimReward: true,
      claimRewardTo: true,
      setClaimablePools: true,

      autolockStop: true,
      autolockProlongate: true,
      autolockKeepUpBalance: true,
      autolockDefault: true,
      autolockAccumulateUnderlying: true,
      autolockAccumulateTill: true,
      setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
      allocatedByPool: 'unknown pool',

      initialize: 'already initialized',
    },
    implOverride: {
      initialize: 'initializer blocked',
    },
  },

  [eContractid.XAGFTokenV1Impl]: {
    reasons: rewardPool.reasons,
    functions: {
      ...rewardPool.functions,
      lock: true,
      allowAdd: true,
      lockAdd: true,
      lockExtend: true,
      redeem: true,
      update: true,

      initializeRewardPool: 'already initialized',
      initializeRewardToken: 'already initialized',
      initializeToken: 'already initialized',
      initialize: 'already initialized',
    },
    implOverride: {
      initializeRewardPool: 'initializer blocked',
      initializeRewardToken: 'initializer blocked',
      initializeToken: 'initializer blocked',
      initialize: 'initializer blocked',
    },
  },

  [eContractid.TokenWeightedRewardPoolImpl]: rewardPoolImpl,

  [eContractid.ReferralRewardPoolV1Impl]: {
    ...rewardPoolImpl,
    functions: {
      transferCodeTo: true,
      registerCustomCode: true,
      claimRewardByPermit: true,
      setPaused: ProtocolErrors.CALLER_NOT_EMERGENCY_ADMIN,
      registerShortCode: ProtocolErrors.CALLER_NOT_REF_ADMIN,
      registerShortCodes: ProtocolErrors.CALLER_NOT_REF_ADMIN,
    },
  },
};

export const getContractAccessExceptions = (name: string): ContractAccessExceptions => {
  return DEFAULT_EXCEPTIONS[name];
};
