import { IAugmentedConfiguration, eEthereumNetwork, IReserveParams, IReserveBorrowParams, ITestConfiguration } from '../../helpers/types';
import { CommonsConfig } from './commons';
import { strategyAAVE, strategyADAI, strategyDAI, strategyLINK, strategyUSDC, strategyUSDT, strategyWBTC, strategyWETH } from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const TestConfig: ITestConfiguration = {
  ...CommonsConfig,
  ProviderId: 1,
  MarketId: 'Augmented test market',
  ReservesConfig: {
    AAVE: strategyAAVE,
    LINK: strategyLINK,
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
  },
}

export const AugmentedConfig: IAugmentedConfiguration = (() => {
  const src = CommonsConfig;
  let cfg: IAugmentedConfiguration = {...src,
    MarketId: 'Augmented genesis market',
    ProviderId: 0, // force autonumbering
    ReservesConfig: {
      DAI: strategyDAI,
      USDC: strategyUSDC,
      USDT: strategyUSDT,
      WBTC: strategyWBTC,
      WETH: strategyWETH,
      ADAI: strategyADAI,
    },
  };

  for (let k of Object.keys(cfg.ReservesConfig)) {
    cfg.ReservesConfig[k] = {...cfg.ReservesConfig[k],
      stableBorrowRateEnabled: false
    };
  }

  // disable oracles for testing and use fallback constants
  cfg.ChainlinkAggregator[eEthereumNetwork.main] = {}; 
  cfg.ChainlinkAggregator[eEthereumNetwork.ropsten] = {}; 
  cfg.ChainlinkAggregator[eEthereumNetwork.kovan] = {}; 

  const defRates = {
    AAVE: 0.13308194,
    LINK: 0.0077041609,
    DAI: 0.0005022851,
    USDC: 0.0005022851,
    USDT: 0.00050314705,
    WBTC: 16.08,
    USD: 0.00050,
    ADAI: 0.0005022851,
  };
  cfg.FallbackOracle[eEthereumNetwork.main] = defRates;
  cfg.FallbackOracle[eEthereumNetwork.ropsten] = defRates;
  cfg.FallbackOracle[eEthereumNetwork.kovan] = defRates;

  return cfg;
})();

// export default AugmentedConfig;
