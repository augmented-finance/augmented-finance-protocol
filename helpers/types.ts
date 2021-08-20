import BigNumber from 'bignumber.js';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork | ePolygonNetwork;

export enum eEthereumNetwork {
  kovan = 'kovan',
  ropsten = 'ropsten',
  rinkeby = 'rinkeby',
  main = 'main',
  coverage = 'coverage',
  hardhat = 'hardhat',
  docker = 'docker',
  tenderlyMain = 'tenderlyMain',
}

export enum ePolygonNetwork {
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  rinkeby = 'rinkeby',
  main = 'main',
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum eContractid {
  MarketAccessController = 'MarketAccessController',
  PreDeployedMarketAccessController = '~MarketAccessController',

  AddressesProviderRegistry = 'AddressesProviderRegistry',
  ValidationLogic = 'ValidationLogic',
  ReserveLogic = 'ReserveLogic',
  GenericLogic = 'GenericLogic',

  LendingRateOracle = 'LendingRateOracle',
  StaticPriceOracle = 'StaticPriceOracle',
  OracleRouter = 'OracleRouter',
  ProtocolDataProvider = 'ProtocolDataProvider',
  WETHGateway = 'WETHGateway',

  TeamRewardPool = 'TeamRewardPool',
  PermitFreezerRewardPool = 'PermitFreezerRewardPool',

  DepositTokenImpl = 'DepositTokenImpl',
  DelegationAwareDepositTokenImpl = 'DelegationAwareDepositTokenImpl',
  StableDebtTokenImpl = 'StableDebtTokenImpl',
  VariableDebtTokenImpl = 'VariableDebtTokenImpl',
  LendingPoolImpl = 'LendingPoolImpl',
  LendingPoolConfiguratorImpl = 'LendingPoolConfiguratorImpl',
  LendingPoolExtensionImpl = 'LendingPoolExtensionImpl',
  StakeConfiguratorImpl = 'StakeConfiguratorImpl',
  StakeTokenImpl = 'StakeTokenImpl',
  TreasuryImpl = 'TreasuryImpl',
  RewardConfiguratorImpl = 'RewardConfiguratorImpl',
  TokenWeightedRewardPoolImpl = 'TokenWeightedRewardPoolImpl',
  XAGFTokenV1Impl = 'XAGFTokenV1Impl',
  AGFTokenV1Impl = 'AGFTokenV1Impl',
  ReferralRewardPoolV1Impl = 'ReferralRewardPoolV1Impl',
  RewardBoosterImpl = 'RewardBoosterImpl',
  TreasuryRewardPool = 'TreasuryRewardPool',

  DelegatedStrategyAave = 'DelegatedStrategyAave',
  DelegatedStrategyCompoundErc20 = 'DelegatedStrategyCompoundErc20',
  DelegatedStrategyCompoundEth = 'DelegatedStrategyCompoundEth',

  UniswapLiquiditySwapAdapter = 'UniswapLiquiditySwapAdapter',
  UniswapRepayAdapter = 'UniswapRepayAdapter',
  FlashLiquidationAdapter = 'FlashLiquidationAdapter',

  MockRewardFreezer = 'MockRewardFreezer',
  MockRewardBooster = 'MockRewardBooster',
  MockPriceOracle = 'MockPriceOracle',
  MockAggregator = 'MockAggregator',
  MockFlashLoanReceiver = 'MockFlashLoanReceiver',
  MockDepositToken = 'MockDepositToken',
  MockStableDebtToken = 'MockStableDebtToken',
  MockVariableDebtToken = 'MockVariableDebtToken',
  MockAgfToken = 'MockAgfToken',
  MockStakedAgfToken = 'MockStakedAgfToken',
  MockStakedAgToken = 'MockStakedAgToken',
  WETHMocked = 'MockWETH',
  MockUniswapV2Router02 = 'MockUniswapV2Router02',
  MockTokenLocker = 'MockTokenLocker',
  MockDecayingTokenLocker = 'MockDecayingTokenLocker',
  MockDelegationAwareDepositToken = 'MockDelegationAwareDepositToken',
  MockMintableERC20 = 'MockMintableERC20',
  MockMintableDelegationERC20 = 'MockMintableDelegationERC20',

  TokenWeightedRewardPoolAGFSeparate = 'MockRewardPoolAGFSeparate',
  TokenWeightedRewardPoolAGFBoosted = 'MockRewardPoolAGFBoosted',
  TokenWeightedRewardPoolAG = 'MockRewardPoolAG',
  TokenWeightedRewardPoolAGBoosted = 'MockRewardPoolAGBoosted',
  TokenWeightedRewardPoolAGUSDCBoosted = 'MockRewardPoolAGUSDCBoosted',
  MockReferralRewardPool = 'MockReferralRewardPool',
  MockDefaultReserveInterestRateStrategy = 'MockDefaultReserveInterestRateStrategy',
}

/*
 * Error messages prefix glossary:
 *  - VL = ValidationLogic
 *  - MATH = Math libraries
 *  - AT = depositToken or DebtTokens
 *  - LP = LendingPool
 *  - LPAPR = AddressesProviderRegistry
 *  - LPC = LendingPoolConfiguration
 *  - RL = ReserveLogic
 *  - LPCM = LendingPoolExtension
 *  - P = Pausable
 */
export enum ProtocolErrors {
  //contract specific errors
  VL_INVALID_AMOUNT = '1', // 'Amount must be greater than 0'
  VL_NO_ACTIVE_RESERVE = '2', // 'Action requires an active reserve'
  VL_RESERVE_FROZEN = '3', // 'Action requires an unfrozen reserve'

  VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5', // 'User cannot withdraw more than the available balance'
  VL_TRANSFER_NOT_ALLOWED = '6', // 'Transfer cannot be allowed.'
  VL_BORROWING_NOT_ENABLED = '7', // 'Borrowing is not enabled'
  VL_INVALID_INTEREST_RATE_MODE_SELECTED = '8', // 'Invalid interest rate mode selected'
  VL_COLLATERAL_BALANCE_IS_0 = '9', // 'The collateral balance is 0'
  VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10', // 'Health factor is lesser than the liquidation threshold'
  VL_COLLATERAL_CANNOT_COVER_NEW_BORROW = '11', // 'There is not enough collateral to cover a new borrow'
  VL_STABLE_BORROWING_NOT_ENABLED = '12', // stable borrowing not enabled
  VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY = '13', // collateral is (mostly) the same currency that is being borrowed
  VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14', // 'The requested amount is greater than the max loan size in stable rate mode
  VL_NO_DEBT_OF_SELECTED_TYPE = '15', // 'for repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
  VL_NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16', // 'To repay on behalf of an user an explicit amount to repay is needed'
  VL_NO_STABLE_RATE_LOAN_IN_RESERVE = '17', // 'User does not have a stable rate loan in progress on this reserve'
  VL_NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18', // 'User does not have a variable rate loan in progress on this reserve'
  VL_UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19', // 'The underlying balance needs to be greater than 0'
  VL_DEPOSIT_ALREADY_IN_USE = '20', // 'User deposit is already being used as collateral'

  LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET = '22', // 'Interest rate rebalance conditions were not met'

  LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR = '27', // 'The caller is not the lending pool configurator'

  CT_CALLER_MUST_BE_LENDING_POOL = '29', // 'The caller of this function must be a lending pool'
  CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30', // 'User cannot give allowance to himself'
  CT_TRANSFER_AMOUNT_NOT_GT_0 = '31', // 'Transferred amount needs to be greater than zero'
  RL_RESERVE_ALREADY_INITIALIZED = '32', // 'Reserve has already been initialized'
  CALLER_NOT_POOL_ADMIN = '33', // 'The caller must be the pool admin'
  LPC_RESERVE_LIQUIDITY_NOT_0 = '34', // The liquidity of the reserve needs to be 0

  LPAPR_PROVIDER_NOT_REGISTERED = '41', // 'Provider is not registered'
  LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD = '42', // 'Health factor is not below the threshold'
  LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED = '43', // 'The collateral chosen cannot be liquidated'
  LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER = '44', // 'User did not borrow the specified currency'
  LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE = '45', // "There isn't enough liquidity available to liquidate"

  MATH_MULTIPLICATION_OVERFLOW = '48',
  MATH_ADDITION_OVERFLOW = '49',
  MATH_DIVISION_BY_ZERO = '50',
  RL_LIQUIDITY_INDEX_OVERFLOW = '51', //  Liquidity index overflows uint128
  RL_VARIABLE_BORROW_INDEX_OVERFLOW = '52', //  Variable borrow index overflows uint128
  RL_LIQUIDITY_RATE_OVERFLOW = '53', //  Liquidity rate overflows uint128
  RL_VARIABLE_BORROW_RATE_OVERFLOW = '54', //  Variable borrow rate overflows uint128
  RL_STABLE_BORROW_RATE_OVERFLOW = '55', //  Stable borrow rate overflows uint128
  CT_INVALID_MINT_AMOUNT = '56', //invalid amount to mint

  CT_INVALID_BURN_AMOUNT = '58', //invalid amount to burn
  LP_BORROW_ALLOWANCE_NOT_ENOUGH = '59', // User borrows on behalf, but allowance are too small

  LP_CALLER_MUST_BE_DEPOSIT_TOKEN = '63',
  LP_IS_PAUSED = '64', // 'Pool is paused'
  LP_NO_MORE_RESERVES_ALLOWED = '65',
  LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN = '66',
  RC_INVALID_LTV = '67',
  RC_INVALID_LIQ_THRESHOLD = '68',
  RC_INVALID_LIQ_BONUS = '69',
  RC_INVALID_DECIMALS = '70',
  RC_INVALID_RESERVE_FACTOR = '71',
  LPAPR_INVALID_ADDRESSES_PROVIDER_ID = '72',
  VL_INCONSISTENT_FLASHLOAN_PARAMS = '73',

  LPC_INVALID_CONFIGURATION = '75',
  CALLER_NOT_EMERGENCY_ADMIN = '76', // The caller must be the emergencya admin
  UL_INVALID_INDEX = '77',
  LP_NOT_CONTRACT = '78',
  SDT_STABLE_DEBT_OVERFLOW = '79',
  SDT_BURN_EXCEEDS_BALANCE = '80',
  CT_CALLER_MUST_BE_REWARD_ADMIN = '81',
  LP_INVALID_PERCENTAGE = '82',
  LP_IS_NOT_TRUSTED_FLASHLOAN = '83',
  CT_CALLER_MUST_BE_SWEEP_ADMIN = '84',
  LP_FLASH_LOAN_RESTRICTED = '85',
  CT_PUMP_DUMP_PROTECTION = '86',
  LP_TOO_MANY_FLASHLOAN_CALLS = '87',
  RW_BASELINE_EXCEEDED = '88',
  RW_NOT_REWARD_RATE_ADMIN = '89',
  RW_NOT_REWARD_CONTROLLER = '90',
  RW_REWARD_PAUSED = '91',
  RW_NOT_TEAM_MANAGER = '92',
  STK_REDEEM_PAUSED = '93',
  STK_INSUFFICIENT_COOLDOWN = '94',
  STK_UNSTAKE_WINDOW_FINISHED = '95',
  STK_INVALID_BALANCE_ON_COOLDOWN = '96',
  STK_EXCESSIVE_SLASH_PCT = '97',
  STK_EXCESSIVE_COOLDOWN_PERIOD = '98',
  STK_WRONG_UNSTAKE_PERIOD = '98',
  VL_INSUFFICIENT_REWARD_AVAILABLE = '99',

  TXT_OWNABLE_CALLER_NOT_OWNER = 'Ownable: caller is not the owner',
  TXT_CALLER_NOT_PROXY_OWNER = 'ProxyOwner: caller is not the owner',
  TXT_ACCESS_RESTRICTED = 'RESTRICTED',

  // old

  INVALID_FROM_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_TO_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_OWNER_REVERT_MSG = 'Ownable: caller is not the owner',
  INVALID_HF = 'Invalid health factor',
  TRANSFER_AMOUNT_EXCEEDS_BALANCE = 'ERC20: transfer amount exceeds balance',
  SAFEERC20_LOWLEVEL_CALL = 'SafeERC20: low-level call failed',
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;

export interface iAssetCommon<T> {
  [key: string]: T;
}
export interface iAssetBase<T> {
  WETH: T;
  DAI: T;
  USDC: T;
  USDT: T;
  WBTC: T;
  USD: T;
  AAVE: T;
  LINK: T;

  ADAI: T;
  CDAI: T;
  CETH: T;
}

const tokenSymbols: iAssetBase<string> = {
  WETH: '',
  DAI: '',
  USDC: '',
  USDT: '',
  WBTC: '',
  USD: '',
  AAVE: '',
  LINK: '',
  ADAI: '',
  CDAI: '',
  CETH: '',
};

type testAssets = 'WETH' | 'DAI' | 'USDT' | 'USDC' | 'WBTC' | 'AAVE' | 'LINK';
type testOnlyAssets = 'AAVE' | 'LINK';

export type iAssetsWithoutUSD<T> = Omit<iAssetBase<T>, 'USD'>;
export type iAssetsWithoutUSDOpt<T> = OmitOpt<iAssetBase<T>, 'USD'>;

export type RecordOpt<K extends keyof any, T> = {
  [P in K]?: T;
};

export type PickOpt<T, K extends keyof T> = {
  [P in K]?: T[P];
};

export type OmitOpt<T, K extends keyof any> = PickOpt<T, Exclude<keyof T, K>>;

export type iTestPoolAssets<T> = Pick<iAssetsWithoutUSD<T>, testAssets>;
export type iAugmentedPoolAssets<T> = Omit<iAssetsWithoutUSD<T>, testOnlyAssets>;
export type iAugmentedPoolAssetsOpt<T> = OmitOpt<iAssetsWithoutUSD<T>, testOnlyAssets>;

type iMultiPoolsAssets<T> = iAssetsWithoutUSD<T> | iAugmentedPoolAssets<T> | iTestPoolAssets<T>;

export type iAssetAggregatorBase<T> = iAssetBase<T>;

export const DefaultTokenSymbols: string[] = Object.keys(tokenSymbols);

export interface IReserveParams extends IReserveBorrowParams, IReserveCollateralParams {
  depositTokenImpl: eContractid;
  reserveFactor: number;
  strategy: IInterestRateStrategyParams;
  reserveDecimals: number;
}

export interface IInterestRateStrategyParams {
  name: string;
  strategyImpl?: eContractid;
  optimalUtilizationRate: string;
  baseVariableBorrowRate: string;
  variableRateSlope1: string;
  variableRateSlope2: string;
  stableRateSlope1: string;
  stableRateSlope2: string;
}

export interface IReserveBorrowParams {
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
}

export interface IReserveCollateralParams {
  baseLTVAsCollateral: number;
  liquidationThreshold: number;
  liquidationBonus: number;
}
export interface IMarketRates {
  borrowRate: string;
}

export type iParamsPerNetwork<T> = iEthereumParamsPerNetwork<T> | iPolygonParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T> extends iEthereumParamsPerNetwork<T>, iPolygonParamsPerNetwork<T> {}

export interface iEthereumParamsPerNetwork<T> {
  [eEthereumNetwork.coverage]: T;
  [eEthereumNetwork.kovan]: T;
  [eEthereumNetwork.ropsten]: T;
  [eEthereumNetwork.rinkeby]: T;
  [eEthereumNetwork.main]: T;
  [eEthereumNetwork.hardhat]: T;
  [eEthereumNetwork.docker]: T;
  [eEthereumNetwork.tenderlyMain]: T;
}

export interface iPolygonParamsPerNetwork<T> {
  [ePolygonNetwork.matic]: T;
  [ePolygonNetwork.mumbai]: T;
}

export enum RateMode {
  None = '0',
  Stable = '1',
  Variable = '2',
}

export interface ObjectString {
  [key: string]: string;
}

export interface IMocksConfig {
  MockUsdPriceInWei: string;
  UsdAddress: tEthereumAddress;
  AllAssetsInitialPrices: iAssetBase<string>;
}

export interface ICommonConfiguration {
  MarketId: string;
  ProviderId: number;

  Names: ITokenNames;

  Mocks: IMocksConfig;
  ProviderRegistry: iParamsPerNetwork<tEthereumAddress | undefined>;
  ProviderRegistryOwner: iParamsPerNetwork<tEthereumAddress | undefined>;
  AddressProvider: iParamsPerNetwork<tEthereumAddress | undefined>;
  AddressProviderOwner: iParamsPerNetwork<tEthereumAddress | undefined>;

  OracleRouter: iParamsPerNetwork<tEthereumAddress>;
  FallbackOracle: iParamsPerNetwork<tEthereumAddress | IPrices>;
  ChainlinkAggregator: iParamsPerNetwork<ITokenAddress>;

  LendingRateOracleRates: iAssetsWithoutUSDOpt<IMarketRates>;

  PoolAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;
  EmergencyAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;

  ReserveAssets: iParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  ReserveAssetsOpt: iParamsPerNetwork<boolean>;
  LendingDisableFeatures: iParamsPerNetwork<LPFeature[]>;

  Dependencies: iParamsPerNetwork<IDependencies>;

  ReservesConfig: {
    [key: string]: IReserveParams;
  };

  StakeParams: IStakeParams;

  RewardParams: IRewardParams;

  ForkTest: IForkTest;

  AGF: IAgfParams;
}

export interface ITestConfiguration extends ICommonConfiguration {
  ReservesConfig: iTestPoolAssets<IReserveParams>;
}

export interface IAugmentedConfiguration extends ICommonConfiguration {
  ReservesConfig: iAugmentedPoolAssets<IReserveParams>;
}

export interface ITokenAddress {
  [token: string]: tEthereumAddress;
}

export type PoolConfiguration = ICommonConfiguration | IAugmentedConfiguration;

export interface IStakeParams {
  MaxSlashBP: number;
  CooldownPeriod: number;
  UnstakePeriod: number;
  StakeToken: iAugmentedPoolAssetsOpt<StakeMode>;
}

export enum StakeMode {
  stakeAg,
  stakeRaw,
}

export interface ITokenNames {
  DepositTokenNamePrefix: string;
  StableDebtTokenNamePrefix: string;
  VariableDebtTokenNamePrefix: string;
  StakeTokenNamePrefix: string;

  SymbolPrefix: string;
  DepositSymbolPrefix: string;
  StableDebtSymbolPrefix: string;
  VariableDebtSymbolPrefix: string;
  StakeSymbolPrefix: string;

  RewardTokenName: string;
  RewardStakeTokenName: string;
  RewardTokenSymbol: string;
  RewardStakeTokenSymbol: string;
}

export interface IRewardParams {
  Autolock: 'disable' | 'stop' | number;
  InitialRateWad: number;
  TokenPools: iAugmentedPoolAssetsOpt<ITokenRewardPoolParams>;
  TeamPool: ITeamPool;
  ReferralPool: IBasicRewardPool;
  TreasuryPool: IBasicRewardPool;
  BurnersPool: IBurnersPool;
}

export interface ITeamPool {
  BasePoints: number;
  Manager: tEthereumAddress;
  UnlockAt: Date;
  Members: ITeamMembers;
}

export interface ITeamMembers {
  [address: string]: number;
}

export interface IBasicRewardPool extends IRewardPoolParams {}

export interface IBurnersPool {
  TotalWad: number;
  BoostFactor: number;
  MeltDownAt: Date;
  Providers: tEthereumAddress[];
}

export interface ITokenRewardPoolParams {
  Share: ITokenTypes<IRewardPoolParams>;
}

export interface ITokenTypes<T> {
  deposit?: T;
  vDebt?: T;
  sDebt?: T;
  stake?: T;
}

export interface IRewardPoolParams {
  BasePoints: number;
  BoostFactor: number;
}

export interface IForkTest {
  Donors: iParamsPerNetwork<ITokenAddress>;
  DonatePct: number;
  DonateTo: tEthereumAddress;
  AutoDepositPct: number;
}

export interface IPrices {
  [token: string]: number;
}

export enum LPFeature {
  LIQUIDATION = 1 << 0,
  FLASHLOAN = 1 << 1,
  FLASHLOAN_DEPOSIT = 1 << 2,
  FLASHLOAN_WITHDRAW = 1 << 3,
  FLASHLOAN_BORROW = 1 << 4,
  FLASHLOAN_REPAY = 1 << 5,
}

export interface IAgfParams {
  DefaultPriceEth?: number;
}

export interface IDependencies {
  UniswapV2Router?: tEthereumAddress;
}
