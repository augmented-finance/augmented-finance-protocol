import { BigNumber } from '@ethersproject/bignumber';
import { MOCK_CHAINLINK_AGGREGATORS_PRICES, DAY, DefaultTokenNames, USD_ADDRESS } from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork, StakeMode, LPFeature, ITokenRewardPoolParams, IRewardPools, eOtherNetwork, IPriceOracleConfig } from '../../helpers/types';
import { BscReserves, BscStableBaseRates } from './reservesConfigs_bsc';
import { MainnetReserves, MainnetStableBaseRates } from './reservesConfigs_main';

const emergencyAdmins = [
  '0x8331Bd35089090249675D023804FC52b7FD18184',
  '0xE1FbbaBbd21764061734424d3F4f5e2C11101E96',
  '0x511EfaE41B0eA33Da847d16e13655009d0aB3Ed7',
];

const tokenRewardStable: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 400,
      BoostFactor: 30000, // 3x
    },
    vDebt: {
      BasePoints: 100,
      BoostFactor: 30000, // 3x
    },
    stake: {
      BasePoints: 300,
      BoostFactor: 30000, // 3x
    },
  }
}

const tokenRewardVolatile: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 200,
      BoostFactor: 30000, // 3x
    },
    vDebt: {
      BasePoints: 50,
      BoostFactor: 30000, // 3x
    },
    stake: {
      BasePoints: 150,
      BoostFactor: 30000, // 3x
    },
  }
}

const tokenRewardStableExt: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 100,
      BoostFactor: 0,
    },
  }
}

const tokenRewardVolatileExt: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 50,
      BoostFactor: 0,
    },
  }
}

const rewardPoolsEthMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI:   tokenRewardStable,
    USDC:  tokenRewardStable,
    USDT:  tokenRewardStable,
    WBTC:  tokenRewardVolatile,
    WETH:  tokenRewardVolatile,

    ADAI:   tokenRewardStableExt,
    AUSDC:  tokenRewardStableExt,
    AUSDT:  tokenRewardStableExt,
    AWBTC:  tokenRewardVolatileExt,
    AWETH:  tokenRewardVolatileExt,

    CDAI:   tokenRewardStableExt,
    CUSDC:  tokenRewardStableExt,
    CUSDT:  tokenRewardStableExt,
    CWBTC:  tokenRewardVolatileExt,
    CETH:   tokenRewardVolatileExt,
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
    MeltDownAt: new Date('2022-04-15'),
    Providers: [],
  },
  RetroPool: {
    TotalWad: 120000,
    BoostFactor: 0,
    MeltDownAt: new Date('2021-11-12'),
    Providers: [],
  },
  TeamPool: {
    BasePoints: 1000,
    UnlockAt: new Date('2021-11-15'),
    Manager: '0x9A48bCEB575Df540EE0038E01dB59DEFc343E514',
    Members: {
      '0x9029AdeFCdafcEce55a0bC0583B2F10E4F35D8f9': 500,
    }
  }
}

const rewardPoolsEthTest: IRewardPools = {
  ...rewardPoolsEthMain,
  InitialRateWad: 1,
}

const rewardPoolsBscMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI:   tokenRewardStable,
    USDC:  tokenRewardStable,
    USDT:  tokenRewardStable,
    WBTC:  tokenRewardVolatile,
    WBNB:  tokenRewardVolatile,
  },
}

const USD_QUOTE: IPriceOracleConfig = {
  QuoteToken: USD_ADDRESS,
  QuoteValue: BigNumber.from(1e8),
}

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Augmented genesis market',
  Names: DefaultTokenNames,
  ProviderId: 0, // Overriden in index.ts

  EmergencyAdmins: {
    [eEthereumNetwork.kovan]: emergencyAdmins,
    [eEthereumNetwork.main]: emergencyAdmins,
    [eOtherNetwork.bsc]: emergencyAdmins,
    [eOtherNetwork.bsc_testnet]: emergencyAdmins,
  },
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '', // '0xa904174e4e6e1ad3FCDf27583544521dcaE16284', //'0x96B2E8707222fD25ce79a998cd47ea8C23E40d14', // '0xFFfdda318F1FE4f048c99E5C6C03C14434B35FA0', // 0xe28BdBF3C2440C97aBA7250ED1bb9F20559E351a
    [eEthereumNetwork.ropsten]: '', // '0x2931bAf940EE995E563BB27BCc7B60Aa8F9af298',
    [eEthereumNetwork.main]: '', // '0x7592C85E1b0C652735264F3b59EdA9Fc4a8f727B'
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.main]: '', // '0xCD73243E7D2254e9D919df41B26d0729b7D8A690' // Gnosis Safe
  },
  AddressProvider: {
    [eEthereumNetwork.main]: '', // '0xc6f769A0c46cFFa57d91E87ED3Bc0cd338Ce6361' 
  },
  AddressProviderOwner: {
    [eEthereumNetwork.main]: '', // '0xCD73243E7D2254e9D919df41B26d0729b7D8A690' // Gnosis Safe
  },
  
  PriceOracle: {
    [eEthereumNetwork.coverage]: 'WETH',
    [eEthereumNetwork.hardhat]: 'WETH',
    [eEthereumNetwork.kovan]: 'WETH',
    [eEthereumNetwork.ropsten]: 'WETH',
    [eEthereumNetwork.rinkeby]: 'WETH',
    [eEthereumNetwork.main]: 'WETH',
    [eEthereumNetwork.tenderlyMain]: 'WETH',
    [eOtherNetwork.bsc]: USD_QUOTE,
    [eOtherNetwork.bsc_testnet]: USD_QUOTE,
  },
  
  FallbackOracle: {},

  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.kovan]: {
      DAI: '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      USDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      USDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
      WBTC: '0xF7904a295A029a3aBDFFB6F12755974a958C7C25',

      AAVE: '0xd04647B7CB523bb9f26730E9B6dE1174db7591Ad',
      BAT: '0x0e4fcEC26c9f85c3D714370c98f43C4E02Fc35Ae',
      BUSD: '0xbF7A18ea5DE0501f7559144e702b29c55b055CcB',
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
      YFI: '0xC5d1B1DEb2992738C0273408ac43e1e906086B6C',
      ZRX: '0xBc3f28Ccc21E9b5856E81E6372aFf57307E2E883',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [eEthereumNetwork.ropsten]: {
      DAI: '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      USDC: '0xe1480303dde539e2c241bdc527649f37c9cbef7d',
      USDT: '0xc08fe0c4d97ccda6b40649c6da621761b628c288',
      WBTC: '0x5b8B87A0abA4be247e660B0e0143bB30Cdf566AF',

      BAT: '0xafd8186c962daf599f171b8600f3e19af7b52c92',
      BUSD: '0x0A32D96Ff131cd5c3E0E5AAB645BF009Eda61564',
      KNC: '0x19d97ceb36624a31d827032d8216dd2eb15e9845',
      LINK: '0xb8c99b98913bE2ca4899CdcaF33a3e519C20EeEc',
      MANA: '0xDab909dedB72573c626481fC98CEE1152b81DEC2',
      MKR: '0x811B1f727F8F4aE899774B568d2e72916D91F392',
      SNX: '0xA95674a8Ed9aa9D2E445eb0024a9aa05ab44f6bf',
      SUSD: '0xe054b4aee7ac7645642dd52f1c892ff0128c98f0',
      TUSD: '0x523ac85618df56e940534443125ef16daf785620',
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
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',

      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      BAT: '0x0d16d4528239e9ee52fa531af613AcdB23D88c94',
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
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
      YFI: '0x7c5d4F8345e66f68099581Db340cd65B078C41f4',
      ZRX: '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962',
    },
    [eEthereumNetwork.tenderlyMain]: {
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',

      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      BAT: '0x0d16d4528239e9ee52fa531af613AcdB23D88c94',
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
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
      YFI: '0x7c5d4F8345e66f68099581Db340cd65B078C41f4',
      ZRX: '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    },    
    [eOtherNetwork.bsc]: {
      // https://docs.chain.link/docs/binance-smart-chain-addresses/
    },
    [eOtherNetwork.bsc_testnet]: {
      // https://docs.chain.link/docs/binance-smart-chain-addresses/
      DAI: '0xE4eE17114774713d2De0eC0f035d4F7665fc025D',  // DAI/USD
      USDC: '0x90c069C4538adAc136E051052E14c1cD799C41B7', // ...
      USDT: '0xEca2605f0BCF2BA5966372C99837b1F182d3D620', // ...
      WBNB: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526',  // BNB/USD
    },
  },

  ReserveAssetsOpt: {
    [eEthereumNetwork.ropsten]: true,
    [eEthereumNetwork.rinkeby]: true,
    [eOtherNetwork.bsc_testnet]: true,

    [eEthereumNetwork.kovan]: false,
    [eEthereumNetwork.coverage]: false,
    [eEthereumNetwork.hardhat]: false,
    [eEthereumNetwork.main]: false,
    [eEthereumNetwork.tenderlyMain]: false,
    [eOtherNetwork.bsc]: false,
  },

  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.kovan]: {
      // AAVE: '0xB597cd8D3217ea6477232F9217fa70837ff667Af',
      DAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      USDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      WBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',

      // https://aave.github.io/aave-addresses/kovan.json
      ADAI: '0xdCf0aF9e59C002FA3AA091a46196b37530FD48a8',
      AUSDC: '0xe12AFeC5aa12Cf614678f9bFeeB98cA9Bb95b5B0',
      AUSDT: '0xFF3c8bc103682FA918c954E84F5056aB4DD5189d',
      AWBTC: '0x62538022242513971478fcC7Fb27ae304AB5C29F',
      AWETH: '0x87b1f4cf9BD63f7BBD3eE1aD04E8F52540349347',

      // https://compound.finance/docs#networks
      CDAI: '0xf0d0eb522cfa50b716b3b1604c4f0fa6f04376ad',
      CETH: '0x41b5844f4680a8c38fbb695b7f9cfd1f64474a72',
      CUSDC: '0x4a92e71227d294f041bd82dd8f78591b75140d63',
      CUSDT: '0x3f0a0ea2f86bae6362cf9799b523ba06647da018',
      CWBTC: '0xa1faa15655b0e7b6b6470ed3d096390e6ad93abb',
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

      // https://docs.aave.com/developers/deployed-contracts/deployed-contracts
      ADAI: '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
      AUSDC: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
      AUSDT: '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811',
      AWBTC: '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
      AWETH: '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',

      // https://compound.finance/docs#networks
      CDAI: '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
      CETH: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
      CUSDC: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
      CUSDT: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
      CWBTC: '0xccf4429db6322d5c611ee964527d42e5d685dd6a', // cWBTC2
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
    [eOtherNetwork.bsc]: {},
    [eOtherNetwork.bsc_testnet]: {
      DAI: '0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867', 
      USDC: '0x64544969ed7ebf5f083679233325356ebe738930', // '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 
      USDT: '0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684', 
      WBNB: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    },
  },

  Dependencies: {
    [eEthereumNetwork.kovan]: {
      WrappedNative: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.ropsten]: {
      WrappedNative: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.rinkeby]: {
      WrappedNative: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.main]: {
      WrappedNative: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.coverage]: {
      WrappedNative: 'WETH',
    },
    [eEthereumNetwork.hardhat]: {
      WrappedNative: 'WETH',
    },
    [eEthereumNetwork.tenderlyMain]: {
      WrappedNative: 'WETH',
    },
    [eOtherNetwork.bsc]: {
      WrappedNative: 'WBNB',
      UniswapV2Router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap
    },
    [eOtherNetwork.bsc_testnet]: {
      WrappedNative: 'WBNB',
      UniswapV2Router: '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', // https://pancake.kiemtienonline360.com/#/swap
    },
  },

  ReservesConfig: {
    [eEthereumNetwork.ropsten]: MainnetReserves,
    [eEthereumNetwork.rinkeby]: MainnetReserves,
    [eEthereumNetwork.coverage]: MainnetReserves,
    [eEthereumNetwork.hardhat]: MainnetReserves,
    [eEthereumNetwork.kovan]: MainnetReserves,
    [eEthereumNetwork.main]: MainnetReserves,
    [eEthereumNetwork.tenderlyMain]: MainnetReserves,

    [eOtherNetwork.bsc]: BscReserves,
    [eOtherNetwork.bsc_testnet]: BscReserves,
  },

  LendingRateOracleRates: {
    [eEthereumNetwork.ropsten]: MainnetStableBaseRates,
    [eEthereumNetwork.rinkeby]: MainnetStableBaseRates,
    [eEthereumNetwork.coverage]: MainnetStableBaseRates,
    [eEthereumNetwork.hardhat]: MainnetStableBaseRates,
    [eEthereumNetwork.kovan]: MainnetStableBaseRates,
    [eEthereumNetwork.main]: MainnetStableBaseRates,
    [eEthereumNetwork.tenderlyMain]: MainnetStableBaseRates,

    [eOtherNetwork.bsc]: BscStableBaseRates,
    [eOtherNetwork.bsc_testnet]: BscStableBaseRates,
  },

  LendingDisableFeatures: {
    [eEthereumNetwork.ropsten]: [],
    [eEthereumNetwork.rinkeby]: [],
    [eEthereumNetwork.coverage]: [],
    [eEthereumNetwork.hardhat]: [],
    [eEthereumNetwork.kovan]: [],
    [eEthereumNetwork.main]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [eEthereumNetwork.tenderlyMain]: [],
    [eOtherNetwork.bsc]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [eOtherNetwork.bsc_testnet]: [],
  },

  StakeParams: {
    MaxSlashBP: 3000, // 30%
    CooldownPeriod: 7 * DAY,
    UnstakePeriod: 7 * DAY,
    StakeToken: {
      DAI:  StakeMode.stakeAg,
      USDC: StakeMode.stakeAg,
      USDT: StakeMode.stakeAg,
      WBTC: StakeMode.stakeAg,
      WETH: StakeMode.stakeAg,
      
      WBNB: StakeMode.stakeAg,
    }
  },

  AGF: {
    DefaultPriceEth: 10.0/2919.23, // at 28 Sep 2021
    UniV2EthPair: {
      Symbol: 'UniV2ETHAGF',
      StakeToken: {
        RewardShare: {
          BasePoints: 1400,
          BoostFactor: 30000, // 3x
        }
      },
    }
  },

  RewardParams: {
    Autolock: 4, // 4 weeks auto-prolongate
    MinBoostBP: 1000, // 10%
    RewardPools: {
      [eEthereumNetwork.main]: rewardPoolsEthMain,

      [eEthereumNetwork.ropsten]: rewardPoolsEthTest,
      [eEthereumNetwork.rinkeby]: rewardPoolsEthTest,
      [eEthereumNetwork.coverage]: rewardPoolsEthTest,
      [eEthereumNetwork.hardhat]: rewardPoolsEthTest,
      [eEthereumNetwork.kovan]: rewardPoolsEthTest,
      [eEthereumNetwork.tenderlyMain]: rewardPoolsEthTest,
      [eOtherNetwork.bsc]: rewardPoolsBscMain,
      [eOtherNetwork.bsc_testnet]: {
        ...rewardPoolsBscMain,
        InitialRateWad: 1,
      },
    },
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
      AUSDC: MOCK_CHAINLINK_AGGREGATORS_PRICES.USDC,
      AUSDT: MOCK_CHAINLINK_AGGREGATORS_PRICES.USDT,
      AWBTC: MOCK_CHAINLINK_AGGREGATORS_PRICES.WBTC,
      AWETH: MOCK_CHAINLINK_AGGREGATORS_PRICES.WETH,

      CDAI: MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI,
      CUSDC: MOCK_CHAINLINK_AGGREGATORS_PRICES.USDC,
      CUSDT: MOCK_CHAINLINK_AGGREGATORS_PRICES.USDT,
      CWBTC: MOCK_CHAINLINK_AGGREGATORS_PRICES.WBTC,
      CETH: MOCK_CHAINLINK_AGGREGATORS_PRICES.WETH,
    },
    UnderlyingMappings: {
      [eEthereumNetwork.kovan]: {
        '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa': '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD', // cDAI -> our.DAI
        '0xb7a4f3e9097c08da09517b5ab877f7a917224ede': '0xe22da380ee6B445bb8273C81944ADEB6E8450422', // cUSDT -> our.USDT
        '0x07de306FF27a2B630B1141956844eB1552B956B5': '0x13512979ADE267AB5100878E2e0f485B568328a4', // cUSDC -> our.USDC
        '0xd3A691C852CDB01E281545A27064741F0B7f6825': '0xD1B98B6607330172f1D991521145A22BCe793277', // cWBTC -> our.WBTC
      },
    }
  },

  ForkTest: {
    Donors: {
      [eEthereumNetwork.main]: {
        AAVE: '0xf977814e90da44bfa03b6295a0616a897441acec', // Binance pool
        DAI: '0x503828976D22510aad0201ac7EC88293211D23Da', // Coinbase
        USDC: '0x503828976D22510aad0201ac7EC88293211D23Da', // Coinbase
        ADAI: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
        CDAI: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
        CETH: '0x8aceab8167c80cb8b3de7fa6228b889bb1130ee8',
      },
    },
    DonatePct: 20,
    DonateTo: '',
    AutoDepositPct: 30,
  }
};
