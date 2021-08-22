import { makeSuite, TestEnv } from './helpers/make-suite';
import { eContractid, ProtocolErrors, tEthereumAddress } from '../../helpers/types';
import { Contract, Signer } from 'ethers';
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
  getMockPriceOracle,
  getMockReferralRewardPool,
  getMockRewardBooster,
  getMockRewardFreezer,
  getMockStableDebtToken,
  getMockStakedAgfToken,
  getMockStakedAgToken,
  getMockTokenLocker,
  getMockVariableDebtToken,
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
} from '../../helpers/contracts-getters';
import { verifyMutableAccess } from '../../helpers/method-checker';
import { falsyOrZeroAddress, getFromJsonDb } from '../../helpers/misc-utils';

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

type contractGetterFn = (() => Promise<Contract>) | ((address?: tEthereumAddress) => Promise<Contract>);

const CONTRACT_GETTERS: Omit<Record<eContractid, contractGetterFn>, ignoredKeys> = {
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

makeSuite('Mutable methods', (testEnv: TestEnv) => {
  let user: Signer;

  before(() => {
    user = testEnv.users[2].signer;
  });

  for (const contractType in CONTRACT_GETTERS) {
    it(contractType, async function () {
      const entry = getFromJsonDb(contractType);
      if (falsyOrZeroAddress(entry?.address)) {
        this.skip();
      }
      const getter = CONTRACT_GETTERS[contractType];
      const subj = (await getter()) as Contract;
      await verifyMutableAccess(user, subj, contractType as eContractid, true);
    });
  }
});
