// @ts-ignore
import {
  eEthereumNetwork,
  eOtherNetwork,
  ePolygonNetwork,
  iParamsPerNetwork,
} from './helpers/types';

require('dotenv').config();

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const TENDERLY_FORK_ID = process.env.TENDERLY_FORK_ID || '';

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.kovan]: ALCHEMY_KEY
    ? `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://kovan.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.ropsten]: ALCHEMY_KEY
    ? `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://ropsten.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.rinkeby]: ALCHEMY_KEY
    ? `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.main]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.coverage]: 'http://localhost:8555',
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.tenderlyMain]: `https://rpc.tenderly.co/fork/${TENDERLY_FORK_ID}`,
  [ePolygonNetwork.mumbai]: 'https://rpc-mumbai.maticvigil.com',
  [ePolygonNetwork.matic]: 'https://rpc-mainnet.matic.network',

  [eOtherNetwork.bsc]: 'https://bsc-dataseed.binance.org/',
  [eOtherNetwork.bsc_testnet]: 'https://data-seed-prebsc-1-s2.binance.org:8545/',
};

const gasPrice = (def: number) => (process.env.GAS_PRICE ? parseInt(process.env.GAS_PRICE) : def) * GWEI;

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.kovan]: gasPrice(1),
  [eEthereumNetwork.ropsten]: gasPrice(10),
  [eEthereumNetwork.rinkeby]: gasPrice(1),
  [eEthereumNetwork.main]: gasPrice(85),
  [eEthereumNetwork.coverage]: gasPrice(65),
  [eEthereumNetwork.hardhat]: gasPrice(65),
  [eEthereumNetwork.tenderlyMain]: 0.01 * GWEI,
  [ePolygonNetwork.mumbai]: gasPrice(1),
  [ePolygonNetwork.matic]: gasPrice(2),

  [eOtherNetwork.bsc_testnet]: gasPrice(10),
  [eOtherNetwork.bsc]: gasPrice(1),
};
