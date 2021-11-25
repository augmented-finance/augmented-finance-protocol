import { BigNumber } from '@ethersproject/bignumber';
import { MOCK_CHAINLINK_AGGREGATORS_PRICES, DAY, DefaultTokenNames, USD_ADDRESS } from '../../helpers/constants';
import {
  ICommonConfiguration,
  eEthereumNetwork,
  StakeMode,
  LPFeature,
  ITokenRewardPoolParams,
  IRewardPools,
  eOtherNetwork,
  IPriceOracleConfig,
  ePolygonNetwork,
} from '../../helpers/types';
import { BscReserves, BscStableBaseRates } from './reservesConfigs_bsc';
import { AvalancheReserves, AvalancheStableBaseRates } from './reservesConfigs_avalanche';
import { FantomReserves, FantomStableBaseRates } from './reservesConfigs_fantom';
import { OptimisticReserves, OptimisticStableBaseRates } from './reservesConfigs_optimistic';

import { MainnetReserves, MainnetStableBaseRates } from './reservesConfigs_main';
import { PolygonReserves, PolygonStableBaseRates } from './reservesConfigs_polygon';
import { ArbitrumReserves, ArbitrumStableBaseRates } from './reservesConfigs_arbitrum';

const emergencyAdmins = [
  '0x8331Bd35089090249675D023804FC52b7FD18184',
  '0xE1FbbaBbd21764061734424d3F4f5e2C11101E96',
  '0x511EfaE41B0eA33Da847d16e13655009d0aB3Ed7',
];

const tokenRewards = (
  depositBP: number,
  vDebtBP: number,
  sDebtBP: number,
  boostFactor = 30000
): ITokenRewardPoolParams => ({
  Share: {
    deposit: {
      BasePoints: depositBP,
      BoostFactor: boostFactor,
    },
    vDebt: {
      BasePoints: vDebtBP,
      BoostFactor: boostFactor,
    },
    stake: {
      BasePoints: sDebtBP,
      BoostFactor: boostFactor,
    },
  },
});

const tokenRewardStable = tokenRewards(400, 100, 300);
const tokenRewardVolatile = tokenRewards(200, 50, 150);

const tokenRewardStableExt: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 100,
      BoostFactor: 0,
    },
  },
};

const tokenRewardVolatileExt: ITokenRewardPoolParams = {
  Share: {
    deposit: {
      BasePoints: 50,
      BoostFactor: 0,
    },
  },
};

const rewardPoolsEthMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI: tokenRewardStable,
    USDC: tokenRewardStable,
    USDT: tokenRewardStable,
    WBTC: tokenRewardVolatile,
    WETH: tokenRewardVolatile,

    ADAI: tokenRewardStableExt,
    AUSDC: tokenRewardStableExt,
    AUSDT: tokenRewardStableExt,
    AWBTC: tokenRewardVolatileExt,
    AWETH: tokenRewardVolatileExt,

    CDAI: tokenRewardStableExt,
    CUSDC: tokenRewardStableExt,
    CUSDT: tokenRewardStableExt,
    CWBTC: tokenRewardVolatileExt,
    CETH: tokenRewardVolatileExt,
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
    },
  },
};

const rewardPoolsEthTest: IRewardPools = {
  ...rewardPoolsEthMain,
  InitialRateWad: 1,
};

const rewardPoolsBscMain: IRewardPools = {
  InitialRateWad: 0.3858024691,
  TokenPools: {
    WBNB: tokenRewards(200, 20, 10),
    BTCB: tokenRewards(200, 20, 10),
    BCH: tokenRewards(100, 10, 5),
    ETH: tokenRewards(200, 20, 10),
    BETH: tokenRewards(100, 10, 5),
    USDT: tokenRewards(200, 20, 10),
    BUSD: tokenRewards(200, 20, 10),
    USDC: tokenRewards(200, 10, 5),
    DAI: tokenRewards(200, 10, 5),
    TUSD: tokenRewards(100, 10, 5),
    DOT: tokenRewards(100, 10, 5),
    XRP: tokenRewards(100, 10, 5),
    ADA: tokenRewards(100, 10, 5),
    LINK: tokenRewards(100, 10, 5),
    MATIC: tokenRewards(100, 10, 5),
    FIL: tokenRewards(75, 5, 5),
    TRX: tokenRewards(75, 5, 5),
    LTC: tokenRewards(75, 5, 5),
    DOGE: tokenRewards(75, 5, 5),
    SXP: tokenRewards(75, 5, 5),
    INJ: tokenRewards(75, 5, 5),
    CHR: tokenRewards(75, 5, 5),
    REEF: tokenRewards(75, 5, 5),
    TWT: tokenRewards(75, 5, 5),
    LINA: tokenRewards(75, 5, 5),
    CAKE: tokenRewards(75, 5, 5),
    XVS: tokenRewards(75, 5, 5),
    AAVE: tokenRewards(75, 5, 5),
    UNI: tokenRewards(75, 5, 5),
    SUSHI: tokenRewards(75, 5, 5),
    ALPACA: tokenRewards(75, 5, 5),
    BIFI: tokenRewards(75, 5, 5),
    AUTO: tokenRewards(75, 5, 5),
    DODO: tokenRewards(75, 5, 5),
    ALPHA: tokenRewards(75, 5, 5),
  },
  ReferralPool: {
    BasePoints: 100,
    BoostFactor: 0,
  },
  TreasuryPool: {
    BasePoints: 2000,
    BoostFactor: 0,
  },
  RetroPool: {
    TotalWad: 3000000,
    BoostFactor: 0,
    MeltDownAt: new Date('2021-11-01'),
    Providers: [],
  },
  TeamPool: {
    BasePoints: 1000,
    UnlockAt: new Date('2021-11-15'),
    Manager: '0x9A48bCEB575Df540EE0038E01dB59DEFc343E514',
    Members: {
      '0x9029AdeFCdafcEce55a0bC0583B2F10E4F35D8f9': 500,
    },
  },
};

const rewardPoolsFantomMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    USDT: tokenRewardStable,
    WETH: tokenRewardVolatile,
    WBTC: tokenRewardVolatile,
    WFTM: tokenRewardVolatile,
  },
};

const rewardPoolsAvalancheMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI: tokenRewardStable,
    USDT: tokenRewardStable,
    WBTC: tokenRewardVolatile,
    WAVAX: tokenRewardVolatile,
  },
};

const rewardPoolsOptimisticMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI: tokenRewardStable,
    USDC: tokenRewardStable,
    USDT: tokenRewardStable,
    WBTC: tokenRewardVolatile,
    WETH: tokenRewardVolatile,
  },
};

const rewardPoolsArbitrumMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI: tokenRewardStable,
    USDC: tokenRewardStable,
    USDT: tokenRewardStable,
    WBTC: tokenRewardVolatile,
    WETH: tokenRewardVolatile,
  },
};

const rewardPoolsPolygonMain: IRewardPools = {
  InitialRateWad: 0,
  TokenPools: {
    DAI: tokenRewardStable,
    USDC: tokenRewardStable,
    USDT: tokenRewardStable,
    WBTC: tokenRewardVolatile,
    WETH: tokenRewardVolatile,
  },
};

const USD_QUOTE: IPriceOracleConfig = {
  QuoteToken: USD_ADDRESS,
  QuoteValue: BigNumber.from(1e8),
};

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
    [eOtherNetwork.fantom_testnet]: emergencyAdmins,
    [eOtherNetwork.avalanche_testnet]: emergencyAdmins,
    [ePolygonNetwork.mumbai]: emergencyAdmins,
    [ePolygonNetwork.arbitrum_testnet]: emergencyAdmins,
    [ePolygonNetwork.optimistic_testnet]: emergencyAdmins,
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
    [eOtherNetwork.avalanche]: USD_QUOTE,
    [eOtherNetwork.avalanche_testnet]: USD_QUOTE,
    [eOtherNetwork.fantom]: USD_QUOTE,
    [eOtherNetwork.fantom_testnet]: USD_QUOTE,
    [ePolygonNetwork.arbitrum]: USD_QUOTE,
    [ePolygonNetwork.arbitrum_testnet]: USD_QUOTE,
    [ePolygonNetwork.optimistic]: USD_QUOTE,
    [ePolygonNetwork.optimistic_testnet]: USD_QUOTE,
    [ePolygonNetwork.matic]: USD_QUOTE,
    [ePolygonNetwork.mumbai]: USD_QUOTE,
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
      WBNB: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
      BTCB: '0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf',
      BCH: '0x43d80f616DAf0b0B42a928EeD32147dC59027D41',
      ETH: '0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e',
      BETH: '0x2A3796273d47c4eD363b361D3AEFb7F7E2A13782',
      USDT: '0xB97Ad0E74fa7d920791E90258A6E2085088b4320',
      BUSD: '0xcBb98864Ef56E9042e7d2efef76141f15731B82f',
      USDC: '0x51597f405303C4377E36123cBc172b13269EA163',
      DAI: '0x132d3C0B1D2cEa0BC552588063bdBb210FDeecfA',
      TUSD: '0xa3334A9762090E827413A7495AfeCE76F41dFc06',
      DOT: '0xC333eb0086309a16aa7c8308DfD32c8BBA0a2592',
      SXP: '0xE188A9875af525d25334d75F3327863B2b8cd0F1',
      XRP: '0x93A67D414896A280bF8FFB3b389fE3686E014fda',
      ADA: '0xa767f745331D267c7751297D982b050c93985627',
      TRX: '0xF4C5e535756D11994fCBB12Ba8adD0192D9b88be',
      LINK: '0xca236E327F629f9Fc2c30A4E95775EbF0B89fac8',
      LTC: '0x74E72F37A8c415c8f1a98Ed42E78Ff997435791D',
      DOGE: '0x3AB0A0d137D4F946fBB19eecc6e92E64660231C8',
      MATIC: '0x7CA57b0cA6367191c94C8914d7Df09A57655905f',
      FIL: '0xE5dbFD9003bFf9dF5feB2f4F445Ca00fb121fb83',
      INJ: '0x63A9133cd7c611d6049761038C16f238FddA71d7',
      CHR: '0x1f771B2b1F3c3Db6C7A1d5F38961a49CEcD116dA',
      REEF: '0x46f13472A4d4FeC9E07E8A00eE52f4Fa77810736',
      TWT: '0x7E728dFA6bCa9023d9aBeE759fDF56BEAb8aC7aD',
      LINA: '0x38393201952f2764E04B290af9df427217D56B41',
      CAKE: '0xB6064eD41d4f67e353768aA239cA86f4F73665a1',
      XVS: '0xBF63F430A79D4036A5900C19818aFf1fa710f206',
      ALPACA: '0xe0073b60833249ffd1bb2af809112c2fbf221DF6',
      UNI: '0xb57f259E7C24e56a1dA00F66b55A5640d9f9E7e4',
      SUSHI: '0xa679C72a97B654CFfF58aB704de3BA15Cde89B07',
      AAVE: '0xA8357BF572460fC40f4B0aCacbB2a6A61c89f475',
      BIFI: '0xaB827b69daCd586A37E80A7d552a4395d576e645',
      AUTO: '0x88E71E6520E5aC75f5338F5F0c9DeD9d4f692cDA',
      DODO: '0x87701B15C08687341c2a847ca44eCfBc8d7873E1',
      ALPHA: '0x7bC032A7C19B1BdCb981D892854d090cfB0f238E',
    },
    [eOtherNetwork.bsc_testnet]: {
      // https://docs.chain.link/docs/binance-smart-chain-addresses/
      DAI: '0xE4eE17114774713d2De0eC0f035d4F7665fc025D', // DAI/USD
      USDC: '0x90c069C4538adAc136E051052E14c1cD799C41B7', // ...
      USDT: '0xEca2605f0BCF2BA5966372C99837b1F182d3D620', // ...
      WBNB: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526', // BNB/USD
    },
    [eOtherNetwork.avalanche_testnet]: {
      WETH: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
      WAVAX: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
      WBTC: '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a',
      USDT: '0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad',
    },
    [eOtherNetwork.avalanche]: {},
    [eOtherNetwork.fantom_testnet]: {
      USDT: '0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128',
      WFTM: '0xe04676B9A9A2973BCb0D1478b5E1E9098BBB7f3D',
      WBTC: '0x65E8d79f3e8e36fE48eC31A2ae935e92F5bBF529',
      WETH: '0xB8C458C957a6e6ca7Cc53eD95bEA548c52AFaA24',
    },
    [eOtherNetwork.fantom]: {},

    [ePolygonNetwork.arbitrum]: {},
    [ePolygonNetwork.arbitrum_testnet]: {
      WBTC: '0x0c9973e7a27d00e656B9f153348dA46CaD70d03d',
      DAI: '0xcAE7d280828cf4a0869b26341155E4E9b864C7b2',
      WETH: '0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8',
      LINK: '0x52C9Eb2Cc68555357221CAe1e5f2dD956bC194E5',
      USDC: '0xe020609A0C31f4F96dCBB8DF9882218952dD95c4',
      USDT: '0xb1Ac85E779d05C2901812d812210F6dE144b2df0',
    },
    [ePolygonNetwork.optimistic]: {},
    [ePolygonNetwork.optimistic_testnet]: {
      AAVE: '0xc051eCEaFd546e0Eb915a97F4D0643BEd7F98a11',
      WBTC: '0x81AE7F8fF54070C52f0eB4EB5b8890e1506AA4f4',
      DAI: '0xa18B00759bF7659Ad47d618734c8073942faFdEc',
      WETH: '0xCb7895bDC70A1a1Dce69b689FD7e43A627475A06',
      LINK: '0xb37aA79EBc31B93864Bff2d5390b385bE482897b',
      USDC: '0xb50cBeeFBCE78cDe83F184B275b5E80c4f01006A',
      USDT: '0x4Dab1Dc2409A037d80316F2379Ac767A477C4236',
    },
    [ePolygonNetwork.matic]: {},
    [ePolygonNetwork.mumbai]: {
      WMATIC: '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada',
      WBTC: '0x007A22900a3B98143368Bd5906f8E17e9867581b',
      DAI: '0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046',
      WETH: '0x0715A7794a1dc8e42615F059dD6e406A6594651A',
      LINK: '0x12162c3E810393dEC01362aBf156D7ecf6159528',
      USDC: '0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0',
      USDT: '0x92C09849638959196E976289418e5973CC96d645',
    },
  },

  ReserveAssetsOpt: {
    [eEthereumNetwork.ropsten]: true,
    [eEthereumNetwork.rinkeby]: true,
    [eOtherNetwork.bsc_testnet]: true,
    [eOtherNetwork.avalanche_testnet]: true,
    [eOtherNetwork.fantom_testnet]: true,
    [ePolygonNetwork.arbitrum_testnet]: true,
    [ePolygonNetwork.optimistic_testnet]: true,
    [ePolygonNetwork.mumbai]: true,

    [eEthereumNetwork.kovan]: false,
    [eEthereumNetwork.coverage]: false,
    [eEthereumNetwork.hardhat]: false,
    [eEthereumNetwork.main]: false,
    [eEthereumNetwork.tenderlyMain]: false,
    [eOtherNetwork.bsc]: false,
    [eOtherNetwork.avalanche]: false,
    [eOtherNetwork.fantom]: false,
    [ePolygonNetwork.arbitrum]: false,
    [ePolygonNetwork.optimistic]: false,
    [ePolygonNetwork.matic]: false,
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
    [eOtherNetwork.bsc]: {
      // https://docs.chain.link/docs/binance-smart-chain-addresses/
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      BTCB: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      BCH: '0x8ff795a6f4d97e7887c79bea79aba5cc76444adf',
      ETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      BETH: '0x250632378e573c6be1ac2f97fcdf00515d0aa91b',
      USDT: '0x55d398326f99059ff775485246999027b3197955',
      BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      DAI: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
      TUSD: '0x14016e85a25aeb13065688cafb43044c2ef86784',
      DOT: '0x7083609fce4d1d8dc0c979aab8c869ea2c873402',
      SXP: '0x47bead2563dcbf3bf2c9407fea4dc236faba485a',
      XRP: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe',
      ADA: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47',
      TRX: '0x85eac5ac2f758618dfa09bdbe0cf174e7d574d5b',
      LINK: '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd',
      LTC: '0x4338665cbb7b2485a8855a139b75d5e34ab0db94',
      DOGE: '0xba2ae424d960c26247dd6c32edc70b295c744c43',
      MATIC: '0xcc42724c6683b7e57334c4e856f4c9965ed682bd',
      FIL: '0x0d8ce2a99bb6e3b7db580ed848240e4a0f9ae153',
      INJ: '0xa2b726b1145a4773f68593cf171187d8ebe4d495',
      CHR: '0xf9CeC8d50f6c8ad3Fb6dcCEC577e05aA32B224FE',
      REEF: '0xf21768ccbc73ea5b6fd3c687208a7c2def2d966e',
      TWT: '0x4b0f1812e5df2a09796481ff14017e6005508003',
      LINA: '0x762539b45a1dcce3d36d080f74d1aed37844b878',
      CAKE: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      XVS: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63',
      ALPACA: '0x8f0528ce5ef7b51152a59745befdd91d97091d2f',
      UNI: '0xbf5140a22578168fd562dccf235e5d43a02ce9b1',
      SUSHI: '0x947950BcC74888a40Ffa2593C5798F11Fc9124C4',
      AAVE: '0xfb6115445bff7b52feb98650c87f44907e58f802',
      BIFI: '0xCa3F508B8e4Dd382eE878A314789373D80A5190A',
      AUTO: '0xa184088a740c695e156f91f5cc086a06bb78b827',
      DODO: '0x67ee3cb086f8a16f34bee3ca72fad36f7db929e2',
      ALPHA: '0xa1faa113cbe53436df28ff0aee54275c13b40975',
    },
    [eOtherNetwork.bsc_testnet]: {
      DAI: '0xec5dcb5dbf4b114c9d0f65bccab49ec54f6a0867',
      USDC: '0x64544969ed7ebf5f083679233325356ebe738930', // '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      USDT: '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd', // '0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684'
      WBNB: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    },
    [eOtherNetwork.fantom]: {},
    [eOtherNetwork.fantom_testnet]: {
      USDT: '0xad280b60ca089625e9d38612710301852f879050',
      WFTM: '0x1957d5e8496628d755a4b2151bca03ecc379bdd6',
      WBTC: '0xa5afdcaad3e67261e2dee707476699ef968cf57c',
      WETH: '0x2d7cd0f70bd71c6bc382cfc752972f41f1f0acd6',
    },
    [eOtherNetwork.avalanche]: {},
    [eOtherNetwork.avalanche_testnet]: {
      WETH: '0xB767287A7143759f294CfB7b1Adbca1140F3de71',
      WAVAX: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
      WBTC: '0x89b7F5fCf00AA31E9e152bC39AbA6c1Ce120A0ED',
      USDT: '0x4C1b0c8721a49351DbB559B2D017ab0CE47280B3',
    },

    [ePolygonNetwork.arbitrum]: {},
    [ePolygonNetwork.arbitrum_testnet]: {
      WBTC: '0x10b1aB71b9708b23A3f31Ccf829293980d37e46E',
      DAI: '0x41ec55d7455427d2a7a8b573f89cb4646e3731bd',
      WETH: '0xd530f42ec6a5df88a82d51534fc6623e0721d6d3',
      LINK: '0xcf80b05e51c018cf213d5358b6c099770c094432', //
      USDC: '0x0ab3f01c2f3a5e16a2573e6feef1bee2dec262f4',
      USDT: '0x9a163588e2db2a449655d5f04aaa7f0fc12dc3cb',
    },
    [ePolygonNetwork.optimistic]: {},
    [ePolygonNetwork.optimistic_testnet]: {
      AAVE: '0x2a6cdb470bfc3635a32798cfd4ea912c703ef293', //
      WBTC: '0x2382a8f65b9120e554d1836a504808ac864e169d',
      DAI: '0xd2a0ee155d20770d0a916f44d4fc0cd1ffc88fff',
      WETH: '0xa6770233d8381cb053de51c3989a8c0befd3ff28',
      LINK: '0x83db01411e8c5b0bcaa0850e7fd90bdf7e180205', //
      USDC: '0x4bec326fe1bef34c4858a1de3906c7f52a95a682',
      USDT: '0x03f2922448261fb9920b5afd0c339a9086f4881e',
    },
    [ePolygonNetwork.matic]: {},
    [ePolygonNetwork.mumbai]: {
      WMATIC: '0xF45444171435d0aCB08a8af493837eF18e86EE27',
      WBTC: '0xc9276ECa6798A14f64eC33a526b547DAd50bDa2F',
      DAI: '0x639cB7b21ee2161DF9c882483C9D55c90c20Ca3e',
      WETH: '0x7aE20397Ca327721F013BB9e140C707F82871b56',
      LINK: '0x7ec62b6fC19174255335C8f4346E0C2fcf870a6B',
      USDC: '0x2271e3Fef9e15046d09E1d78a8FF038c691E9Cf9',
      USDT: '0xF8744C0bD8C7adeA522d6DDE2298b17284A79D1b',
    },
  },

  Dependencies: {
    [eEthereumNetwork.kovan]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.ropsten]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.rinkeby]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.main]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
      UniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    [eEthereumNetwork.coverage]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [eEthereumNetwork.hardhat]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [eEthereumNetwork.tenderlyMain]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [eOtherNetwork.bsc]: {
      WrappedNative: 'WBNB',
      AgfPair: 'BUSD',
      UniswapV2Router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap
    },
    [eOtherNetwork.bsc_testnet]: {
      WrappedNative: 'WBNB',
      AgfPair: 'USDC',
      UniswapV2Router: '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', // https://pancake.kiemtienonline360.com/#/swap
    },
    [eOtherNetwork.fantom]: {
      WrappedNative: 'WFTM',
      AgfPair: 'WFTM',
    },
    [eOtherNetwork.fantom_testnet]: {
      WrappedNative: 'WFTM',
      AgfPair: 'WFTM',
    },
    [eOtherNetwork.avalanche]: {
      WrappedNative: 'WAVAX',
      AgfPair: 'WAVAX',
    },
    [eOtherNetwork.avalanche_testnet]: {
      WrappedNative: 'WAVAX',
      AgfPair: 'WAVAX',
    },

    [ePolygonNetwork.arbitrum]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [ePolygonNetwork.arbitrum_testnet]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [ePolygonNetwork.optimistic]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [ePolygonNetwork.optimistic_testnet]: {
      WrappedNative: 'WETH',
      AgfPair: 'WETH',
    },
    [ePolygonNetwork.matic]: {
      WrappedNative: 'WMATIC',
      AgfPair: 'WMATIC',
    },
    [ePolygonNetwork.mumbai]: {
      WrappedNative: 'WMATIC',
      AgfPair: 'WMATIC',
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
    [eOtherNetwork.fantom]: FantomReserves,
    [eOtherNetwork.fantom_testnet]: FantomReserves,
    [eOtherNetwork.avalanche]: AvalancheReserves,
    [eOtherNetwork.avalanche_testnet]: AvalancheReserves,

    [ePolygonNetwork.arbitrum]: ArbitrumReserves,
    [ePolygonNetwork.arbitrum_testnet]: ArbitrumReserves,
    [ePolygonNetwork.optimistic]: OptimisticReserves,
    [ePolygonNetwork.optimistic_testnet]: OptimisticReserves,
    [ePolygonNetwork.matic]: PolygonReserves,
    [ePolygonNetwork.mumbai]: PolygonReserves,
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

    [eOtherNetwork.fantom]: FantomStableBaseRates,
    [eOtherNetwork.fantom_testnet]: FantomStableBaseRates,
    [eOtherNetwork.avalanche]: AvalancheStableBaseRates,
    [eOtherNetwork.avalanche_testnet]: AvalancheStableBaseRates,

    [ePolygonNetwork.arbitrum]: ArbitrumStableBaseRates,
    [ePolygonNetwork.arbitrum_testnet]: ArbitrumStableBaseRates,
    [ePolygonNetwork.optimistic]: OptimisticStableBaseRates,
    [ePolygonNetwork.optimistic_testnet]: OptimisticStableBaseRates,
    [ePolygonNetwork.matic]: PolygonStableBaseRates,
    [ePolygonNetwork.mumbai]: PolygonStableBaseRates,
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
    [eOtherNetwork.fantom]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [eOtherNetwork.fantom_testnet]: [],
    [eOtherNetwork.avalanche]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [eOtherNetwork.avalanche_testnet]: [],

    [ePolygonNetwork.arbitrum]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [ePolygonNetwork.arbitrum_testnet]: [],
    [ePolygonNetwork.optimistic]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [ePolygonNetwork.optimistic_testnet]: [],
    [ePolygonNetwork.matic]: [LPFeature.FLASHLOAN, LPFeature.FLASHLOAN_DEPOSIT, LPFeature.FLASHLOAN_BORROW],
    [ePolygonNetwork.mumbai]: [],
  },

  StakeParams: {
    MaxSlashBP: 3000, // 30%
    CooldownPeriod: 7 * DAY,
    UnstakePeriod: 7 * DAY,
    StakeToken: {
      WBTC: StakeMode.stakeAg,
      WETH: StakeMode.stakeAg,

      WAVAX: StakeMode.stakeAg,
      WFTM: StakeMode.stakeAg,
      WMATIC: StakeMode.stakeAg,

      WBNB: StakeMode.stakeAg,
      BTCB: StakeMode.stakeAg,
      BCH: StakeMode.stakeAg,
      ETH: StakeMode.stakeAg,
      BETH: StakeMode.stakeAg,
      USDT: StakeMode.stakeAg,
      BUSD: StakeMode.stakeAg,
      USDC: StakeMode.stakeAg,
      DAI: StakeMode.stakeAg,
      TUSD: StakeMode.stakeAg,
      DOT: StakeMode.stakeAg,
      SXP: StakeMode.stakeAg,
      XRP: StakeMode.stakeAg,
      ADA: StakeMode.stakeAg,
      TRX: StakeMode.stakeAg,
      LINK: StakeMode.stakeAg,
      LTC: StakeMode.stakeAg,
      DOGE: StakeMode.stakeAg,
      MATIC: StakeMode.stakeAg,
      FIL: StakeMode.stakeAg,
      INJ: StakeMode.stakeAg,
      CHR: StakeMode.stakeAg,
      REEF: StakeMode.stakeAg,
      TWT: StakeMode.stakeAg,
      LINA: StakeMode.stakeAg,
      CAKE: StakeMode.stakeAg,
      XVS: StakeMode.stakeAg,
      ALPACA: StakeMode.stakeAg,
      UNI: StakeMode.stakeAg,
      SUSHI: StakeMode.stakeAg,
      AAVE: StakeMode.stakeAg,
      BIFI: StakeMode.stakeAg,
      AUTO: StakeMode.stakeAg,
      DODO: StakeMode.stakeAg,
      ALPHA: StakeMode.stakeAg,
    },
  },

  AGF: {
    DefaultPriceEth: 10.0 / 2919.23, // at 28 Sep 2021
    UniV2EthPair: {
      Symbol: 'UniV2ETHAGF',
      StakeToken: {
        RewardShare: {
          BasePoints: 1500,
          BoostFactor: 30000, // 3x
        },
      },
    },
  },

  RewardParams: {
    Autolock: 4, // 4 weeks auto-prolongate
    MinBoostBP: 5000, // 50%
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
      [eOtherNetwork.fantom]: rewardPoolsFantomMain,
      [eOtherNetwork.fantom_testnet]: {
        ...rewardPoolsFantomMain,
        InitialRateWad: 1,
      },
      [eOtherNetwork.avalanche]: rewardPoolsAvalancheMain,
      [eOtherNetwork.avalanche_testnet]: {
        ...rewardPoolsAvalancheMain,
        InitialRateWad: 1,
      },

      [ePolygonNetwork.arbitrum]: rewardPoolsArbitrumMain, //temp
      [ePolygonNetwork.arbitrum_testnet]: {
        ...rewardPoolsOptimisticMain, //temp
        InitialRateWad: 1,
      },
      [ePolygonNetwork.optimistic]: rewardPoolsOptimisticMain,
      [ePolygonNetwork.optimistic_testnet]: {
        ...rewardPoolsOptimisticMain,
        InitialRateWad: 1,
      },
      [ePolygonNetwork.matic]: rewardPoolsPolygonMain, //temp
      [ePolygonNetwork.mumbai]: {
        ...rewardPoolsPolygonMain, //temp
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
    },
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
  },
};
