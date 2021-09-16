import { Contract } from '@ethersproject/contracts';
import {
  getAddressesProviderRegistry,
  getAGFTokenV1Impl,
  getDefaultReserveInterestRateStrategy,
  getDelegatedStrategyAave,
  getDelegatedStrategyCompoundErc20,
  getDelegatedStrategyCompoundEth,
  getDelegationAwareDepositToken,
  getDepositStakeTokenImpl,
  getDepositToken,
  getFlashLiquidationAdapter,
  getLendingPoolConfiguratorProxy,
  getLendingPoolExtensionImpl,
  getLendingPoolProxy,
  getLendingRateOracle,
  getMarketAddressController,
  getMockAgfToken,
  getMockDecayingTokenLocker,
  getMockDepositStakeToken,
  getMockDepositToken,
  getMockReferralRewardPool,
  getMockRewardBooster,
  getMockRewardFreezer,
  getMockStakedAgfToken,
  getMockTokenLocker,
  getOracleRouter,
  getPermitFreezerRewardPool,
  getPriceFeedCompoundErc20,
  getPriceFeedCompoundEth,
  getProtocolDataProvider,
  getReferralRewardPoolImpl,
  getRewardBooster,
  getRewardConfiguratorProxy,
  getStableDebtToken,
  getStakeConfiguratorImpl,
  getStakeTokenImpl,
  getStaticPriceOracle,
  getTeamRewardPool,
  getTokenWeightedRewardPool,
  getTokenWeightedRewardPoolAG,
  getTreasuryProxy,
  getTreasuryRewardPool,
  getUniswapLiquiditySwapAdapter,
  getUniswapRepayAdapter,
  getVariableDebtToken,
  getWETHGateway,
  getXAGFTokenV1Impl,
} from './contracts-getters';
import { eContractid, tEthereumAddress } from './types';

type ContractGetterFn = (address: tEthereumAddress) => Promise<Contract>;

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

  [eContractid.DepositTokenImpl]: getDepositToken,
  [eContractid.DelegationAwareDepositTokenImpl]: getDelegationAwareDepositToken,
  [eContractid.StableDebtTokenImpl]: getStableDebtToken,
  [eContractid.VariableDebtTokenImpl]: getVariableDebtToken,
  [eContractid.LendingPoolImpl]: getLendingPoolProxy,
  [eContractid.LendingPoolConfiguratorImpl]: getLendingPoolConfiguratorProxy,
  [eContractid.LendingPoolExtensionImpl]: getLendingPoolExtensionImpl,
  [eContractid.StakeConfiguratorImpl]: getStakeConfiguratorImpl,
  [eContractid.StakeTokenImpl]: getStakeTokenImpl,
  [eContractid.TreasuryImpl]: getTreasuryProxy,
  [eContractid.RewardConfiguratorImpl]: getRewardConfiguratorProxy,
  [eContractid.TokenWeightedRewardPoolImpl]: getTokenWeightedRewardPool,
  [eContractid.XAGFTokenV1Impl]: getXAGFTokenV1Impl,
  [eContractid.AGFTokenV1Impl]: getAGFTokenV1Impl,
  [eContractid.ReferralRewardPoolV1Impl]: getReferralRewardPoolImpl,
  [eContractid.RewardBoosterImpl]: getRewardBooster,
  [eContractid.DepositStakeTokenImpl]: getDepositStakeTokenImpl,

  [eContractid.TreasuryRewardPool]: getTreasuryRewardPool,
  [eContractid.PermitFreezerRewardPool]: getPermitFreezerRewardPool,
  [eContractid.DefaultReserveInterestRateStrategy]: getDefaultReserveInterestRateStrategy,
  [eContractid.PriceFeedCompoundEth]: getPriceFeedCompoundEth,
  [eContractid.PriceFeedCompoundErc20]: getPriceFeedCompoundErc20,

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
  [eContractid.MockTokenLocker]: getMockTokenLocker,
  [eContractid.MockDecayingTokenLocker]: getMockDecayingTokenLocker,
  [eContractid.MockDepositStakeToken]: getMockDepositStakeToken,

  [eContractid.TokenWeightedRewardPoolAG]: getTokenWeightedRewardPoolAG,
  [eContractid.MockReferralRewardPool]: getMockReferralRewardPool,
};

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
  | eContractid.MockDefaultReserveInterestRateStrategy
  | eContractid.ValidationLogic
  | eContractid.ReserveLogic
  | eContractid.GenericLogic;

export const getContractGetterById = (id: string): [eContractid, ContractGetterFn] => {
  const fn = CONTRACT_GETTERS[id];
  if (fn !== undefined) {
    return [id as eContractid, fn];
  }
  const pos = id.indexOf('-');
  if (pos < 0) {
    return [id as eContractid, fn];
  }
  const subName = id.substring(0, pos);
  return [subName as eContractid, CONTRACT_GETTERS[subName]];
};
