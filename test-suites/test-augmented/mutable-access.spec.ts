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
import { getContractGetterById } from '../../helpers/contract-mapper';

makeSuite('Mutable methods', (testEnv: TestEnv) => {
  let user: Signer;

  before(() => {
    user = testEnv.users[2].signer;
  });

  for (const contractType in eContractid) {
    const getter = getContractGetterById(contractType);
    if (getter == undefined) {
      continue;
    }

    it(contractType, async function () {
      const entry = getFromJsonDb(contractType);
      if (falsyOrZeroAddress(entry?.address)) {
        this.skip();
      }
      const subj = (await getter()) as Contract;
      await verifyMutableAccess(user, subj, contractType as eContractid, true);
    });
  }
});
