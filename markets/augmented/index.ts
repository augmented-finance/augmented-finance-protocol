import { IAugmentedConfiguration, eEthereumNetwork, ITestConfiguration } from '../../helpers/types';
import { CommonsConfig } from './commons';
import { TestReserves, TestStableBaseRates } from './reservesConfigs';
import { MainnetReserves, MainnetStableBaseRates } from './reservesConfigs_main';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const TestConfig: ITestConfiguration = {
  ...CommonsConfig,
  ProviderId: 1,
  MarketId: 'Augmented test market',
  ReservesConfig: TestReserves,
  LendingRateOracleRates: TestStableBaseRates,
}

export const AugmentedConfig: IAugmentedConfiguration = (() => {
  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';

  const src = CommonsConfig;
  let cfg: IAugmentedConfiguration = {...src,
    MarketId: 'Augmented genesis market',
    ProviderId: 0, // force autonumbering
    ReservesConfig: MainnetReserves,
    LendingRateOracleRates: MainnetStableBaseRates,
  };

  const defRates = {
    AAVE: 0.13308194,
    LINK: 0.0077041609,
    DAI: 0.0005022851,
    USDC: 0.0005022851,
    USDT: 0.00050314705,
    WBTC: 16.08,
    USD: 0.00050,
    ADAI: '288590000000000',
    CDAI: '6232965267370',
    CETH: '20052742934920745'
  };

  for (const [key, value] of Object.entries(cfg.ReserveAssetsOpt)) {
    if (value) {
      cfg.FallbackOracle[key] = defRates;
    }
  }
  if (MAINNET_FORK) {
    cfg.LendingDisableFeatures[eEthereumNetwork.main] = [];
    cfg.RewardParams.RewardPools[eEthereumNetwork.main].InitialRateWad = 1;
  }

  return cfg;
})();
