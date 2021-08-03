import { ZERO_ADDRESS } from '../../helpers/constants';
import { IAugmentedConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyAAVE,
  strategyWBTC,
  strategyWETH,
  strategyLINK,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AugmentedConfig: IAugmentedConfiguration = {
  ...CommonsConfig,
  MarketId: 'Augmented genesis market',
  ProviderId: 1,
  ReservesConfig: {
    AAVE: strategyAAVE,
    LINK: strategyLINK,
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: {
      AAVE: 0.13308194,
      LINK: 0.0077041609,
      DAI: 0.0005022851,
      USDC: 0.0005022851,
      USDT: 0.00050314705,
      WBTC: 16.08,
      USD: 0.00050,
    },
    [eEthereumNetwork.tenderlyMain]: '',
  },
  ChainlinkAggregator: { // disable all oracles for testing
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.rinkeby]: {}, 
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.tenderlyMain]: {},
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.kovan]: {
      AAVE: '0xB597cd8D3217ea6477232F9217fa70837ff667Af',
      // BUSD: '0x4c6E1EFC12FDfD568186b7BAEc0A43fFfb4bCcCf',
      DAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      LINK: '0xAD5ce863aE3E4E9394Ab43d4ba0D80f419F61789',
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      USDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      WBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    },
    [eEthereumNetwork.ropsten]: {
      AAVE: ZERO_ADDRESS,
      // BUSD: '0xFA6adcFf6A90c11f31Bc9bb59eC0a6efB38381C6',
      DAI: '0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108',
      LINK: '0x1a906E71FF9e28d8E01460639EB8CF0a6f0e2486',
      USDC: '0x851dEf71f0e6A903375C1e536Bd9ff1684BAD802',
      USDT: '0xB404c51BBC10dcBE948077F18a4B8E553D160084',
      WBTC: '0xa0E54Ab6AA5f0bf1D62EC3526436F3c05b3348A0',
      WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
    },
    [eEthereumNetwork.rinkeby]: {
      AAVE: ZERO_ADDRESS,
      DAI: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
      LINK: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      USDT: ZERO_ADDRESS,
      WBTC: '0xa63ad1ef1c6e2bc42a299b9d66fcdb895df85f01',
      WETH: ZERO_ADDRESS,
    }, // TODO:
    [eEthereumNetwork.main]: {
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      // BUSD: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    [eEthereumNetwork.tenderlyMain]: {
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
};

export default AugmentedConfig;
