import BigNumber from 'bignumber.js';
import { ONE_ADDRESS, oneRay, RAY, ZERO_ADDRESS, MOCK_CHAINLINK_AGGREGATORS_PRICES, DAY, DefaultTokenNames } from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork, StakeMode } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  Names: DefaultTokenNames,
  ProviderId: 0, // Overriden in index.ts
  ProtocolGlobalParams: {
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.docker]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderlyMain]: undefined,
  },
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.docker]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderlyMain]: undefined,
  },
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  AddressProvider: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  AddressProviderOwner: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.docker]: ZERO_ADDRESS,
    [eEthereumNetwork.kovan]: ZERO_ADDRESS, 
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS, 
    [eEthereumNetwork.rinkeby]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderlyMain]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.kovan]: {
      AAVE: '0xd04647B7CB523bb9f26730E9B6dE1174db7591Ad',
      BAT: '0x0e4fcEC26c9f85c3D714370c98f43C4E02Fc35Ae',
      BUSD: '0xbF7A18ea5DE0501f7559144e702b29c55b055CcB',
      DAI: '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      ENJ: '0xfaDbe2ee798889F02d1d39eDaD98Eff4c7fe95D4',
      KNC: '0xb8E8130d244CFd13a75D6B9Aee029B1C33c808A7',
      LINK: '0x3Af8C569ab77af5230596Acf0E8c2F9351d24C38',
      MANA: '0x1b93D8E109cfeDcBb3Cc74eD761DE286d5771511',
      MKR: '0x0B156192e04bAD92B6C1C13cf8739d14D78D5701',
      REN: '0xF1939BECE7708382b5fb5e559f630CB8B39a10ee',
      SNX: '0xF9A76ae7a1075Fe7d646b06fF05Bd48b9FA5582e',
      SUSD: '0xb343e7a1aF578FA35632435243D814e7497622f7',
      TUSD: '0x7aeCF1c19661d12E962b69eBC8f6b2E63a55C660',
      UNI: '0x17756515f112429471F86f98D5052aCB6C47f6ee',
      USDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      USDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
      WBTC: '0xF7904a295A029a3aBDFFB6F12755974a958C7C25',
      YFI: '0xC5d1B1DEb2992738C0273408ac43e1e906086B6C',
      ZRX: '0xBc3f28Ccc21E9b5856E81E6372aFf57307E2E883',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [eEthereumNetwork.ropsten]: {
      AAVE: ZERO_ADDRESS,
      BAT: '0xafd8186c962daf599f171b8600f3e19af7b52c92',
      BUSD: '0x0A32D96Ff131cd5c3E0E5AAB645BF009Eda61564',
      DAI: '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      ENJ: ZERO_ADDRESS,
      KNC: '0x19d97ceb36624a31d827032d8216dd2eb15e9845',
      LINK: '0xb8c99b98913bE2ca4899CdcaF33a3e519C20EeEc',
      MANA: '0xDab909dedB72573c626481fC98CEE1152b81DEC2',
      MKR: '0x811B1f727F8F4aE899774B568d2e72916D91F392',
      REN: ZERO_ADDRESS,
      SNX: '0xA95674a8Ed9aa9D2E445eb0024a9aa05ab44f6bf',
      SUSD: '0xe054b4aee7ac7645642dd52f1c892ff0128c98f0',
      TUSD: '0x523ac85618df56e940534443125ef16daf785620',
      UNI: ZERO_ADDRESS,
      USDC: '0xe1480303dde539e2c241bdc527649f37c9cbef7d',
      USDT: '0xc08fe0c4d97ccda6b40649c6da621761b628c288',
      WBTC: '0x5b8B87A0abA4be247e660B0e0143bB30Cdf566AF',
      YFI: ZERO_ADDRESS,
      ZRX: '0x1d0052e4ae5b4ae4563cbac50edc3627ca0460d7',
      USD: '0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507',
    },
    [eEthereumNetwork.rinkeby]: {
      AAVE: ZERO_ADDRESS,
      BAT: ZERO_ADDRESS,
      BUSD: ZERO_ADDRESS,
      DAI: '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D',
      ENJ: ZERO_ADDRESS,
      KNC: ZERO_ADDRESS,
      LINK: ZERO_ADDRESS,
      MANA: ZERO_ADDRESS,
      MKR: ZERO_ADDRESS,
      REN: ZERO_ADDRESS,
      SNX: ZERO_ADDRESS,
      SUSD: ZERO_ADDRESS,
      TUSD: ZERO_ADDRESS,
      UNI: ZERO_ADDRESS,
      USDC: '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
      USDT: ZERO_ADDRESS,
      WBTC: '0x2431452A0010a43878bF198e170F6319Af6d27F4',
      YFI: ZERO_ADDRESS,
      ZRX: ZERO_ADDRESS,
      USD: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
    }, 
    [eEthereumNetwork.main]: {
      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      BAT: '0x0d16d4528239e9ee52fa531af613AcdB23D88c94',
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      ENJ: '0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B',
      KNC: '0x656c0544eF4C98A6a98491833A89204Abb045d6b',
      LINK: '0xDC530D9457755926550b59e8ECcdaE7624181557',
      MANA: '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9',
      MKR: '0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2',
      REN: '0x3147D7203354Dc06D9fd350c7a2437bcA92387a4',
      SNX: '0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c',
      SUSD: '0x8e0b7e6062272B5eF4524250bFFF8e5Bd3497757',
      TUSD: '0x3886BA987236181D98F2401c507Fb8BeA7871dF2',
      UNI: '0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      YFI: '0x7c5d4F8345e66f68099581Db340cd65B078C41f4',
      ZRX: '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    },
    [eEthereumNetwork.tenderlyMain]: {
      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      BAT: '0x0d16d4528239e9ee52fa531af613AcdB23D88c94',
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      ENJ: '0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B',
      KNC: '0x656c0544eF4C98A6a98491833A89204Abb045d6b',
      LINK: '0xDC530D9457755926550b59e8ECcdaE7624181557',
      MANA: '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9',
      MKR: '0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2',
      REN: '0x3147D7203354Dc06D9fd350c7a2437bcA92387a4',
      SNX: '0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c',
      SUSD: '0x8e0b7e6062272B5eF4524250bFFF8e5Bd3497757',
      TUSD: '0x3886BA987236181D98F2401c507Fb8BeA7871dF2',
      UNI: '0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      YFI: '0x7c5d4F8345e66f68099581Db340cd65B078C41f4',
      ZRX: '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.tenderlyMain]: {},
  },
  ReservesConfig: {},
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.docker]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.rinkeby]: '0xdf032bc4b9dc2782bb09352007d4c57b75160b15',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderlyMain]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },

  StakeParams: {
    MaxSlashBP: 3000, // 30%
    CooldownPeriod: 2 * DAY,
    UnstakePeriod: DAY,
    StakeToken: {
      DAI:  StakeMode.stakeAg,
      USDC: StakeMode.stakeAg,
      USDT: StakeMode.stakeAg,
      WBTC: StakeMode.stakeAg,
      WETH: StakeMode.stakeAg,
    }
  },

  RewardParams : {
    InitialRate: 100,
    TokenPools: {
      DAI:   {
        Share: {
          deposit: {
            BasePoints: 100,
            BoostFactor: 1,
          },
          vDebt: {
            BasePoints: 200,
            BoostFactor: 1,
          },
          stake: {
            BasePoints: 500,
            BoostFactor: 0,
          },
        }
      },
      USDC:   {
        Share: {
          deposit: {
            BasePoints: 1000,
            BoostFactor: 0,
          },
          vDebt: {
            BasePoints: 1200,
            BoostFactor: 0,
          },
          stake: {
            BasePoints: 1500,
            BoostFactor: 0,
          },
        }
      },
    },
    TeamPool: {
      Share: 1000,
      UnlockAt: new Date('2021-11-01'),
      Manager: ZERO_ADDRESS,
      Members: {
        '0x0000000000000000000000000000000000000001': 5000
      }
    }
  },

  ForkTest: {
    Donors: {
      [eEthereumNetwork.coverage]: {},
      [eEthereumNetwork.hardhat]: {},
      [eEthereumNetwork.kovan]: {},
      [eEthereumNetwork.ropsten]: {},
      [eEthereumNetwork.docker]: {},
      [eEthereumNetwork.rinkeby]: {},
      [eEthereumNetwork.main]: {
        AAVE: '0xf977814e90da44bfa03b6295a0616a897441acec', // Binance pool
        DAI: '0x503828976D22510aad0201ac7EC88293211D23Da', // Coinbase
        USDC: '0x503828976D22510aad0201ac7EC88293211D23Da' // Coinbase
      },
      [eEthereumNetwork.tenderlyMain]: {},
    },
    DonatePct: 50,
    To: '',
  }
};
