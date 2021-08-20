import { oneRay, ZERO_ADDRESS, MOCK_CHAINLINK_AGGREGATORS_PRICES, DAY, DefaultTokenNames, ONE_ADDRESS } from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork, StakeMode, LPFeature } from '../../helpers/types';
import { strategyAAVE, strategyADAI, strategyDAI, strategyLINK, strategyUSDC, strategyUSDT, strategyWBTC, strategyWETH } from './reservesConfigs';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  Names: DefaultTokenNames,
  ProviderId: 0, // Overriden in index.ts

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  LendingRateOracleRates: {
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
    [eEthereumNetwork.kovan]: '', // 0xe28BdBF3C2440C97aBA7250ED1bb9F20559E351a
    [eEthereumNetwork.ropsten]: '', // '0x2931bAf940EE995E563BB27BCc7B60Aa8F9af298',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.kovan]: '0xFFfdda318F1FE4f048c99E5C6C03C14434B35FA0',
    [eEthereumNetwork.ropsten]: '', // '0x31B29E1d3524f281f513B34F3855Ee8E473c0264',
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
  OracleRouter: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.docker]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderlyMain]: '',
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
      BAT: '0xafd8186c962daf599f171b8600f3e19af7b52c92',
      BUSD: '0x0A32D96Ff131cd5c3E0E5AAB645BF009Eda61564',
      DAI: '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      KNC: '0x19d97ceb36624a31d827032d8216dd2eb15e9845',
      LINK: '0xb8c99b98913bE2ca4899CdcaF33a3e519C20EeEc',
      MANA: '0xDab909dedB72573c626481fC98CEE1152b81DEC2',
      MKR: '0x811B1f727F8F4aE899774B568d2e72916D91F392',
      SNX: '0xA95674a8Ed9aa9D2E445eb0024a9aa05ab44f6bf',
      SUSD: '0xe054b4aee7ac7645642dd52f1c892ff0128c98f0',
      TUSD: '0x523ac85618df56e940534443125ef16daf785620',
      USDC: '0xe1480303dde539e2c241bdc527649f37c9cbef7d',
      USDT: '0xc08fe0c4d97ccda6b40649c6da621761b628c288',
      WBTC: '0x5b8B87A0abA4be247e660B0e0143bB30Cdf566AF',
      ZRX: '0x1d0052e4ae5b4ae4563cbac50edc3627ca0460d7',
      USD: '0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507',
    },
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D',
      USDC: '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
      WBTC: '0x2431452A0010a43878bF198e170F6319Af6d27F4',
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

  ReserveAssetsOpt: {
    [eEthereumNetwork.ropsten]: true,
    [eEthereumNetwork.rinkeby]: true,
    [eEthereumNetwork.kovan]: true,

    [eEthereumNetwork.coverage]: false,
    [eEthereumNetwork.hardhat]: false,
    [eEthereumNetwork.docker]: false,
    [eEthereumNetwork.main]: false,
    [eEthereumNetwork.tenderlyMain]: false,
  },

  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.kovan]: {
      // AAVE: '0xB597cd8D3217ea6477232F9217fa70837ff667Af',
      DAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      USDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      WBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      CETH: '0x41b5844f4680a8c38fbb695b7f9cfd1f64474a72',
      CDAI: '0xf0d0eb522cfa50b716b3b1604c4f0fa6f04376ad',
      ADAI: '0xdcf0af9e59c002fa3aa091a46196b37530fd48a8',
    },
    [eEthereumNetwork.ropsten]: {
      DAI: '0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108',
      LINK: '0x1a906E71FF9e28d8E01460639EB8CF0a6f0e2486',
      USDC: '0x851dEf71f0e6A903375C1e536Bd9ff1684BAD802',
      USDT: '0xB404c51BBC10dcBE948077F18a4B8E553D160084',
      WBTC: '0xa0E54Ab6AA5f0bf1D62EC3526436F3c05b3348A0',
      WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
    },
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
      WBTC: '0xa63ad1ef1c6e2bc42a299b9d66fcdb895df85f01',
      WETH: '0xdf032bc4b9dc2782bb09352007d4c57b75160b15',
    },
    [eEthereumNetwork.main]: {
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      ADAI: '0x028171bca77440897b824ca71d1c56cac55b68a3',
      CDAI: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      CETH: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
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

  Dependencies: {
    [eEthereumNetwork.kovan]: {
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.ropsten]: {
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.rinkeby]: {
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.main]: {
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },

    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.docker]: {},
    [eEthereumNetwork.tenderlyMain]: {},
  },

  ReservesConfig: {},

  LendingDisableFeatures: {
    [eEthereumNetwork.ropsten]: [],
    [eEthereumNetwork.rinkeby]: [],
    [eEthereumNetwork.coverage]: [],
    [eEthereumNetwork.hardhat]: [],
    [eEthereumNetwork.docker]: [],
    [eEthereumNetwork.kovan]: [],
    [eEthereumNetwork.main]: [LPFeature.LIQUIDATION, LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [eEthereumNetwork.tenderlyMain]: [],
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

  AGF: {
    DefaultPriceEth: 10.0/3000.0,
  },

  RewardParams: {
    Autolock: 12, // 12 weeks auto-prolongate
    InitialRateWad: 2.12,
    TokenPools: {
      DAI:   {
        Share: {
          deposit: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          vDebt: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          stake: {
            BasePoints: 400,
            BoostFactor: 3,
          },
        }
      },
      USDC:   {
        Share: {
          deposit: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          vDebt: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          stake: {
            BasePoints: 400,
            BoostFactor: 3,
          },
        }
      },
      USDT:   {
        Share: {
          deposit: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          vDebt: {
            BasePoints: 200,
            BoostFactor: 3,
          },
          stake: {
            BasePoints: 400,
            BoostFactor: 3,
          },
        }
      },
      WBTC:   {
        Share: {
          deposit: {
            BasePoints: 100,
            BoostFactor: 3,
          },
          vDebt: {
            BasePoints: 100,
            BoostFactor: 3,
          },
          stake: {
            BasePoints: 200,
            BoostFactor: 3,
          },
        }
      },
      WETH:   {
        Share: {
          deposit: {
            BasePoints: 100,
            BoostFactor: 3,
          },
          vDebt: {
            BasePoints: 100,
            BoostFactor: 3,
          },
          stake: {
            BasePoints: 200,
            BoostFactor: 3,
          },
        }
      },
    },
    ReferralPool: {
      BasePoints: 100,
      BoostFactor: 0,
    },
    TreasuryPool: {
      BasePoints: 1000,
      BoostFactor: 0,
    },
    BurnersPool: {
      TotalWad: 1e6,
      BoostFactor: 0,
      MeltDownAt: new Date('2021-03-01'),
      Providers: [ ONE_ADDRESS ],
    },
    TeamPool: {
      BasePoints: 1000,
      UnlockAt: new Date('2021-12-01'),
      Manager: ZERO_ADDRESS,
      Members: {
        '0x0000000000000000000000000000000000000001': 5000
      }
    }
  },

  // ----------------
  // DEV AND TEST PARAMS
  // ----------------

  Mocks: {
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',

    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
      ADAI: MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI,
      CDAI: MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI,
      CETH: MOCK_CHAINLINK_AGGREGATORS_PRICES.WETH,
    },
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
        USDC: '0x503828976D22510aad0201ac7EC88293211D23Da', // Coinbase
        ADAI: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
        CDAI: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
        CETH: '0x8aceab8167c80cb8b3de7fa6228b889bb1130ee8',
      },
      [eEthereumNetwork.tenderlyMain]: {},
    },
    DonatePct: 20,
    DonateTo: '',
    AutoDepositPct: 30,
  }
};
