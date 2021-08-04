import { IAugmentedConfiguration, eEthereumNetwork } from '../../helpers/types';
import { CommonsConfig } from './commons';
import { strategyDAI, strategyUSDC, strategyUSDT, strategyWBTC, strategyWETH } from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const TestConfig: IAugmentedConfiguration = {
  ...CommonsConfig,
  ProviderId: 1,
}

export const AugmentedConfig: IAugmentedConfiguration = (() => {
  let cfg: IAugmentedConfiguration = CommonsConfig;
  
  cfg.MarketId = 'Augmented genesis market';
  cfg.ProviderId = 1;

  cfg.ReservesConfig = {
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
  };
  // disable oracles for testing and use fallback constants
  cfg.ChainlinkAggregator[eEthereumNetwork.main] = {}; 
  cfg.FallbackOracle[eEthereumNetwork.main] = {
    AAVE: 0.13308194,
    LINK: 0.0077041609,
    DAI: 0.0005022851,
    USDC: 0.0005022851,
    USDT: 0.00050314705,
    WBTC: 16.08,
    USD: 0.00050,
  };

  return cfg;
})();

export default AugmentedConfig;
