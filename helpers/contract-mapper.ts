import { Contract } from '@ethersproject/contracts';
import {
  getAddressesProviderRegistry,
  getDelegatedStrategyAave,
  getDelegatedStrategyCompoundErc20,
  getDelegatedStrategyCompoundEth,
  getFlashLiquidationAdapter,
  getLendingRateOracle,
  getMarketAddressController,
  getMockAgfToken,
  getMockDecayingTokenLocker,
  getMockDepositToken,
  getMockReferralRewardPool,
  getMockRewardBooster,
  getMockRewardFreezer,
  getMockStakedAgfToken,
  getMockStakedAgToken,
  getMockTokenLocker,
  getOracleRouter,
  getPermitFreezerRewardPool,
  getProtocolDataProvider,
  getStaticPriceOracle,
  getTeamRewardPool,
  getTokenWeightedRewardPoolAG,
  getTreasuryRewardPool,
  getUniswapLiquiditySwapAdapter,
  getUniswapRepayAdapter,
  getWETHGateway,
} from './contracts-getters';
import { eContractid, tEthereumAddress } from './types';

type ignoredKeys =
  | eContractid.PreDeployedMarketAccessController
  | eContractid.WETHMocked
  | eContractid.MockUniswapV2Router02
  | eContractid.MockUniswapV2Router02
  | eContractid.MockDelegationAwareDepositToken
  | eContractid.MockMintableERC20
  | eContractid.MockMintableDelegationERC20
  | eContractid.MockAggregator
  | eContractid.MockFlashLoanReceiver
  | eContractid.TokenWeightedRewardPoolAGFSeparate
  | eContractid.TokenWeightedRewardPoolAGFBoosted
  | eContractid.TokenWeightedRewardPoolAGBoosted
  | eContractid.TokenWeightedRewardPoolAGUSDCBoosted
  | eContractid.MockPriceOracle
  | eContractid.MockStableDebtToken
  | eContractid.MockVariableDebtToken
  | eContractid.MockDefaultReserveInterestRateStrategy // ?
  | eContractid.DepositTokenImpl
  | eContractid.DelegationAwareDepositTokenImpl
  | eContractid.StableDebtTokenImpl
  | eContractid.VariableDebtTokenImpl
  | eContractid.LendingPoolImpl
  | eContractid.LendingPoolConfiguratorImpl
  | eContractid.LendingPoolExtensionImpl
  | eContractid.StakeConfiguratorImpl
  | eContractid.StakeTokenImpl
  | eContractid.TreasuryImpl
  | eContractid.RewardConfiguratorImpl
  | eContractid.TokenWeightedRewardPoolImpl
  | eContractid.XAGFTokenV1Impl
  | eContractid.AGFTokenV1Impl
  | eContractid.ReferralRewardPoolV1Impl
  | eContractid.RewardBoosterImpl
  | eContractid.ValidationLogic
  | eContractid.ReserveLogic
  | eContractid.GenericLogic;

type ContractGetterFn = (address?: tEthereumAddress) => Promise<Contract>;

const CONTRACT_GETTERS: Omit<Record<eContractid, ContractGetterFn>, ignoredKeys> = {
  [eContractid.MarketAccessController]: getMarketAddressController,
  [eContractid.AddressesProviderRegistry]: getAddressesProviderRegistry,

  [eContractid.LendingRateOracle]: getLendingRateOracle,
  [eContractid.StaticPriceOracle]: getStaticPriceOracle,
  [eContractid.OracleRouter]: getOracleRouter,
  [eContractid.ProtocolDataProvider]: getProtocolDataProvider,
  [eContractid.WETHGateway]: getWETHGateway,

  [eContractid.TeamRewardPool]: getTeamRewardPool,
  [eContractid.PermitFreezerRewardPool]: getPermitFreezerRewardPool,

  // [eContractid.DepositTokenImpl]: getDepositTokenImpl,
  // [eContractid.DelegationAwareDepositTokenImpl]: getDelegationAwareDepositTokenImpl,
  // [eContractid.StableDebtTokenImpl]: getStableDebtTokenImpl,
  // [eContractid.VariableDebtTokenImpl]: getVariableDebtTokenImpl,
  // [eContractid.LendingPoolImpl]: getLendingPoolImpl,
  // [eContractid.LendingPoolConfiguratorImpl]: getLendingPoolConfiguratorImpl,
  // [eContractid.LendingPoolExtensionImpl]: getLendingPoolExtensionImpl,
  // [eContractid.StakeConfiguratorImpl]: getStakeConfiguratorImpl,
  // [eContractid.StakeTokenImpl]: getStakeTokenImpl,
  // [eContractid.TreasuryImpl]: getTreasuryImpl,
  // [eContractid.RewardConfiguratorImpl]: getRewardConfiguratorImpl,
  // [eContractid.TokenWeightedRewardPoolImpl]: getTokenWeightedRewardPoolImpl,
  // [eContractid.XAGFTokenV1Impl]: getXAGFTokenV1Impl,
  // [eContractid.AGFTokenV1Impl]: getAGFTokenV1Impl,
  // [eContractid.ReferralRewardPoolV1Impl]: getReferralRewardPoolV1Impl,
  // [eContractid.RewardBoosterImpl]: getRewardBoosterImpl,

  [eContractid.TreasuryRewardPool]: getTreasuryRewardPool,

  [eContractid.DelegatedStrategyAave]: getDelegatedStrategyAave,
  [eContractid.DelegatedStrategyCompoundErc20]: getDelegatedStrategyCompoundErc20,
  [eContractid.DelegatedStrategyCompoundEth]: getDelegatedStrategyCompoundEth,

  [eContractid.UniswapLiquiditySwapAdapter]: getUniswapLiquiditySwapAdapter,
  [eContractid.UniswapRepayAdapter]: getUniswapRepayAdapter,
  [eContractid.FlashLiquidationAdapter]: getFlashLiquidationAdapter,

  [eContractid.MockRewardFreezer]: getMockRewardFreezer,
  [eContractid.MockRewardBooster]: getMockRewardBooster,
  [eContractid.MockDepositToken]: getMockDepositToken,
  [eContractid.MockAgfToken]: getMockAgfToken,
  [eContractid.MockStakedAgfToken]: getMockStakedAgfToken,
  [eContractid.MockStakedAgToken]: getMockStakedAgToken,
  [eContractid.MockTokenLocker]: getMockTokenLocker,
  [eContractid.MockDecayingTokenLocker]: getMockDecayingTokenLocker,

  [eContractid.TokenWeightedRewardPoolAG]: getTokenWeightedRewardPoolAG,
  [eContractid.MockReferralRewardPool]: getMockReferralRewardPool,
};

export const getContractGetterById = (id: string): ContractGetterFn => {
  return CONTRACT_GETTERS[id];
};
