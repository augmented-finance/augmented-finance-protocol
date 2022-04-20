import dotenv from 'dotenv';

import {
  eEthereumNetwork,
  eOtherNetwork,
  ePolygonNetwork,
  iParamsPerNetwork,
  iParamsPerNetworkOpt,
} from './helpers/types';

dotenv.config();

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const TENDERLY_FORK_ID = process.env.TENDERLY_FORK_ID || '';
const MORALIS_KEY = process.env.MORALIS_KEY || '';

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
  [eOtherNetwork.bsc_testnet]: 'https://data-seed-prebsc-1-s2.binance.org:8545/',
  [eOtherNetwork.bsc]: 'https://bsc-dataseed.binance.org/',
  [eOtherNetwork.avalanche_testnet]: 'https://api.avax-test.network/ext/bc/C/rpc',
  [eOtherNetwork.avalanche]: MORALIS_KEY
    ? `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/mainnet`
    : 'https://api.avax.network/ext/bc/C/rpc',
  [eOtherNetwork.fantom_testnet]: 'https://rpc.testnet.fantom.network/',
  [eOtherNetwork.fantom]: 'https://rpcapi.fantom.network/',
  [ePolygonNetwork.arbitrum_testnet]: 'https://rinkeby.arbitrum.io/rpc',
  [ePolygonNetwork.arbitrum]: 'https://arb1.arbitrum.io/rpc',
  [ePolygonNetwork.optimistic_testnet]: 'https://kovan.optimism.io',
  [ePolygonNetwork.optimistic]: 'https://mainnet.optimism.io',
  [ePolygonNetwork.mumbai]: 'https://rpc-mumbai.maticvigil.com',
  [ePolygonNetwork.matic]: 'https://rpc-mainnet.matic.network',
  [eOtherNetwork.gnosis]: 'https://gno.getblock.io/mainnet/?api_key=9568d8d8-f02f-4e6b-8cfc-b12f1ad8c01a',
  // [eOtherNetwork.gnosis]: 'http://localhost:8545',
};

export const FORK_RPC_URL: iParamsPerNetworkOpt<string> = {
  [eOtherNetwork.bsc]: MORALIS_KEY
    ? `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/bsc/mainnet/archive`
    : undefined,
  [eOtherNetwork.avalanche]: MORALIS_KEY
    ? `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/mainnet`
    : 'https://api.avax.network/ext/bc/C/rpc',
};

const gasPrice = (def: number) => (process.env.GAS_PRICE ? parseInt(process.env.GAS_PRICE) : def) * GWEI;

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number | 'auto'> = {
  [eEthereumNetwork.kovan]: gasPrice(1),
  [eEthereumNetwork.ropsten]: gasPrice(10),
  [eEthereumNetwork.rinkeby]: gasPrice(1),
  [eEthereumNetwork.main]: gasPrice(85),
  [eEthereumNetwork.coverage]: gasPrice(65),
  [eEthereumNetwork.hardhat]: gasPrice(25),
  [eEthereumNetwork.tenderlyMain]: 0.01 * GWEI,
  [eOtherNetwork.bsc_testnet]: gasPrice(10),
  [eOtherNetwork.bsc]: gasPrice(1),
  [eOtherNetwork.avalanche_testnet]: gasPrice(30),
  [eOtherNetwork.avalanche]: gasPrice(25),
  [eOtherNetwork.fantom_testnet]: gasPrice(10),
  [eOtherNetwork.fantom]: gasPrice(1),
  [ePolygonNetwork.arbitrum_testnet]: 'auto',
  [ePolygonNetwork.arbitrum]: 'auto',
  [ePolygonNetwork.optimistic_testnet]: 'auto',
  [ePolygonNetwork.optimistic]: 'auto',
  [ePolygonNetwork.mumbai]: gasPrice(1),
  [ePolygonNetwork.matic]: gasPrice(2),
  [eOtherNetwork.gnosis]: gasPrice(2),
};
