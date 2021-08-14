import { IAugmentedConfiguration, eEthereumNetwork, IReserveParams, IReserveBorrowParams } from '../../helpers/types';
import { CommonsConfig } from './commons';
import { strategyDAI, strategyUSDC, strategyUSDT, strategyWBTC, strategyWETH } from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const TestConfig: IAugmentedConfiguration = {
  ...CommonsConfig,
  ProviderId: 1,
  MarketId: 'Augmented test market',
}

export const AugmentedConfig: IAugmentedConfiguration = (() => {
  const src = CommonsConfig;
  let cfg: IAugmentedConfiguration = {...src};
  
  cfg.MarketId = 'Augmented genesis market';
  cfg.ProviderId = 0; // force autonumbering

  cfg.ReservesConfig = {... src.ReservesConfig};
  for (let k of Object.keys(cfg.ReservesConfig)) {
    cfg.ReservesConfig[k] = {...src.ReservesConfig[k],
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
  };
  cfg.FallbackOracle[eEthereumNetwork.main] = defRates;
  cfg.FallbackOracle[eEthereumNetwork.ropsten] = defRates;
  cfg.FallbackOracle[eEthereumNetwork.kovan] = defRates;

  return cfg;
})();

// export default AugmentedConfig;
