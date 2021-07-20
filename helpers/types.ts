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

export enum LendingPools {
  // proto = 'proto',
  // matic = 'matic',
  augmented = 'augmented',
}

export enum eContractid {
  MarketAccessController = 'MarketAccessController',
  AddressesProviderRegistry = 'AddressesProviderRegistry',
  ValidationLogic = 'ValidationLogic',
  ReserveLogic = 'ReserveLogic',
  GenericLogic = 'GenericLogic',
  MockPriceOracle = 'MockPriceOracle',
  MockAggregator = 'MockAggregator',
  LendingRateOracle = 'LendingRateOracle',
  OracleRouter = 'OracleRouter',
  MockFlashLoanReceiver = 'MockFlashLoanReceiver',
  WalletBalanceProvider = 'WalletBalanceProvider',
  MockDepositToken = 'MockDepositToken',
  MockStableDebtToken = 'MockStableDebtToken',
  MockVariableDebtToken = 'MockVariableDebtToken',
  MockAgfToken = 'MockAgfToken',
  MockStakedAgfToken = 'MockStakedAgfToken',
  MockStakedAgToken = 'MockStakedAgToken',
  ProtocolDataProvider = 'ProtocolDataProvider',
  WETHGateway = 'WETHGateway',
  WETH = 'WETH',
  WETHMocked = 'WETHMocked',

  DepositTokenImpl = 'DepositTokenImpl',
  DelegationAwareDepositTokenImpl = 'DelegationAwareDepositTokenImpl',
  StableDebtTokenImpl = 'StableDebtTokenImpl',
  VariableDebtTokenImpl = 'VariableDebtTokenImpl',
  LendingPoolImpl = 'LendingPoolImpl',
  LendingPoolConfiguratorImpl = 'LendingPoolConfiguratorImpl',
  LendingPoolCollateralManagerImpl = 'LendingPoolCollateralManagerImpl',
  MockUniswapV2Router02 = 'MockUniswapV2Router02',
  UniswapLiquiditySwapAdapter = 'UniswapLiquiditySwapAdapter',
  UniswapRepayAdapter = 'UniswapRepayAdapter',
  FlashLiquidationAdapter = 'FlashLiquidationAdapter',

  RewardController = 'RewardController',
  RewardBooster = 'RewardBooster',
  MockTokenLocker = 'MockTokenLocker',
  MockDecayingTokenLocker = 'MockDecayingTokenLocker',

  TeamRewardPool = 'TeamRewardPool',
  ReferralRewardPool = 'ReferralRewardPool',

  TokenWeightedRewardPoolAGFSeparate = 'TokenWeightedRewardPoolAGFSeparate',
  TokenWeightedRewardPoolAGF = 'TokenWeightedRewardPoolAGF',
  TokenWeightedRewardPoolAGFBoosted = 'TokenWeightedRewardPoolAGFBoosted',
  TokenWeightedRewardPoolAG = 'TokenWeightedRewardPoolAG',
  TokenWeightedRewardPoolAGBoosted = 'TokenWeightedRewardPoolAGBoosted',
  TokenWeightedRewardPoolAGUSDCBoosted = 'TokenWeightedRewardPoolAGUSDCBoosted',

  PermitFreezerRewardPool = 'PermitFreezerRewardPool',

  StakeConfiguratorImpl = 'StakeConfiguratorImpl',
  StakeTokenImpl = 'StakeTokenImpl',
  TreasuryImpl = 'TreasuryImpl',

  RewardConfiguratorImpl = 'RewardConfiguratorImpl',
  TokenWeightedRewardPoolImpl = 'TokenWeightedRewardPoolImpl',
  XAGFTokenV1Impl = 'XAGFTokenV1Impl',
  AGFTokenV1Impl = 'AGFTokenV1Impl',
}

/*
 * Error messages prefix glossary:
 *  - VL = ValidationLogic
 *  - MATH = Math libraries
 *  - AT = aToken or DebtTokens
 *  - LP = LendingPool
 *  - LPAPR = AddressesProviderRegistry
 *  - LPC = LendingPoolConfiguration
 *  - RL = ReserveLogic
 *  - LPCM = LendingPoolCollateralManager
 *  - P = Pausable
 */
export enum ProtocolErrors {
  //common errors
  CALLER_NOT_POOL_ADMIN = '33', // 'The caller must be the pool admin'

  //contract specific errors
  VL_INVALID_AMOUNT = '1', // 'Amount must be greater than 0'
  VL_NO_ACTIVE_RESERVE = '2', // 'Action requires an active reserve'
  VL_RESERVE_FROZEN = '3', // 'Action requires an unfrozen reserve'
  VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4', // 'The current liquidity is not enough'
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
  LP_NOT_ENOUGH_STABLE_BORROW_BALANCE = '21', // 'User does not have any stable rate loan for this reserve'
  LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET = '22', // 'Interest rate rebalance conditions were not met'
  LP_LIQUIDATION_CALL_FAILED = '23', // 'Liquidation call failed'
  LP_NOT_ENOUGH_LIQUIDITY_TO_BORROW = '24', // 'There is not enough liquidity available to borrow'
  LP_REQUESTED_AMOUNT_TOO_SMALL = '25', // 'The requested amount is too small for a FlashLoan.'
  LP_INCONSISTENT_PROTOCOL_ACTUAL_BALANCE = '26', // 'The actual balance of the protocol is inconsistent'
  LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR = '27', // 'The caller is not the lending pool configurator'
  LP_INCONSISTENT_FLASHLOAN_PARAMS = '28',
  CT_CALLER_MUST_BE_LENDING_POOL = '29', // 'The caller of this function must be a lending pool'
  CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30', // 'User cannot give allowance to himself'
  CT_TRANSFER_AMOUNT_NOT_GT_0 = '31', // 'Transferred amount needs to be greater than zero'
  RL_RESERVE_ALREADY_INITIALIZED = '32', // 'Reserve has already been initialized'
  LPC_RESERVE_LIQUIDITY_NOT_0 = '34', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_ATOKEN_POOL_ADDRESS = '35', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS = '36', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS = '37', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '38', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '39', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_ADDRESSES_PROVIDER_ID = '40', // 'The liquidity of the reserve needs to be 0'
  LPC_CALLER_NOT_EMERGENCY_ADMIN = '76', // 'The caller must be the emergencya admin'
  LPAPR_PROVIDER_NOT_REGISTERED = '41', // 'Provider is not registered'
  LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD = '42', // 'Health factor is not below the threshold'
  LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED = '43', // 'The collateral chosen cannot be liquidated'
  LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER = '44', // 'User did not borrow the specified currency'
  LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE = '45', // "There isn't enough liquidity available to liquidate"
  LPCM_NO_ERRORS = '46', // 'No errors'
  LP_INVALID_FLASHLOAN_MODE = '47', //Invalid flashloan mode selected
  MATH_MULTIPLICATION_OVERFLOW = '48',
  MATH_ADDITION_OVERFLOW = '49',
  MATH_DIVISION_BY_ZERO = '50',
  RL_LIQUIDITY_INDEX_OVERFLOW = '51', //  Liquidity index overflows uint128
  RL_VARIABLE_BORROW_INDEX_OVERFLOW = '52', //  Variable borrow index overflows uint128
  RL_LIQUIDITY_RATE_OVERFLOW = '53', //  Liquidity rate overflows uint128
  RL_VARIABLE_BORROW_RATE_OVERFLOW = '54', //  Variable borrow rate overflows uint128
  RL_STABLE_BORROW_RATE_OVERFLOW = '55', //  Stable borrow rate overflows uint128
  CT_INVALID_MINT_AMOUNT = '56', //invalid amount to mint
  LP_FAILED_REPAY_WITH_COLLATERAL = '57',
  CT_INVALID_BURN_AMOUNT = '58', //invalid amount to burn
  LP_BORROW_ALLOWANCE_NOT_ENOUGH = '59', // User borrows on behalf, but allowance are too small
  LP_FAILED_COLLATERAL_SWAP = '60',
  LP_INVALID_EQUAL_ASSETS_TO_SWAP = '61',
  LP_REENTRANCY_NOT_ALLOWED = '62',
  LP_CALLER_MUST_BE_AN_ATOKEN = '63',
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
  LP_INCONSISTENT_PARAMS_LENGTH = '74',
  LPC_INVALID_CONFIGURATION = '75',
  CALLER_NOT_EMERGENCY_ADMIN = '76',
  UL_INVALID_INDEX = '77',
  LP_NOT_CONTRACT = '78',
  SDT_STABLE_DEBT_OVERFLOW = '79',
  SDT_BURN_EXCEEDS_BALANCE = '80',
  CT_CALLER_MUST_BE_REWARD_ADMIN = '81',
  LP_INVALID_PERCENTAGE = '82',
  LP_IS_NOT_SPONSORED_LOAN = '83',
  CT_CALLER_MUST_BE_SWEEP_ADMIN = '84',
  LP_FLASH_LOAN_RESTRICTED = '85',
  CT_PUMP_DUMP_PROTECTION = '86',
  LP_LIQUIDATION_DISABLED = '87',
  RW_NOT_REWARD_CONFIG_ADMIN = '88',
  RW_NOT_REWARD_RATE_ADMIN = '89',
  RW_NOT_REWARD_CONTROLLER = '90',
  RW_REWARD_PAUSED = '91',
  RW_NOT_TEAM_MANAGER = '92',

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
}

export type iAssetsWithoutETH<T> = Omit<iAssetBase<T>, 'ETH'>;

export type iAssetsWithoutUSD<T> = Omit<iAssetBase<T>, 'USD'>;

export type RecordOpt<K extends keyof any, T> = {
  [P in K]?: T;
};

export type PickOpt<T, K extends keyof T> = {
  [P in K]?: T[P];
};

type augmentedAssets = 'DAI' | 'USDC' | 'USDT' | 'WBTC' | 'WETH';

export type iAugmentedPoolAssets<T> = Pick<iAssetsWithoutUSD<T>, augmentedAssets>;
export type iAugmentedPoolAssetsOpt<T> = PickOpt<iAssetsWithoutUSD<T>, augmentedAssets>;

export type iMultiPoolsAssets<T> = iAssetCommon<T> | iAugmentedPoolAssets<T>;

export type iAssetAggregatorBase<T> = iAssetsWithoutETH<T>;

export const TokenContractId: iAssetBase<string> = {
  AAVE: 'AAVE',
  LINK: 'LINK',

  WETH: 'WETH',
  DAI: 'DAI',
  USDC: 'USDC',
  USDT: 'USDT',
  WBTC: 'WBTC',

  USD: 'USD',
};

export interface IReserveParams extends IReserveBorrowParams, IReserveCollateralParams {
  aTokenImpl: eContractid;
  reserveFactor: string;
  strategy: IInterestRateStrategyParams;
}

export interface IInterestRateStrategyParams {
  name: string;
  optimalUtilizationRate: string;
  baseVariableBorrowRate: string;
  variableRateSlope1: string;
  variableRateSlope2: string;
  stableRateSlope1: string;
  stableRateSlope2: string;
}

export interface IReserveBorrowParams {
  // optimalUtilizationRate: string;
  // baseVariableBorrowRate: string;
  // variableRateSlope1: string;
  // variableRateSlope2: string;
  // stableRateSlope1: string;
  // stableRateSlope2: string;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  reserveDecimals: string;
}

export interface IReserveCollateralParams {
  baseLTVAsCollateral: string;
  liquidationThreshold: string;
  liquidationBonus: string;
}
export interface IMarketRates {
  borrowRate: string;
}

export type iParamsPerNetwork<T> = iEthereumParamsPerNetwork<T> | iPolygonParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T>
  extends iEthereumParamsPerNetwork<T>,
    iPolygonParamsPerNetwork<T> {}

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

export interface iParamsPerPool<T> {
  // [LendingPools.proto]: T;
  // [LendingPools.matic]: T;
  [LendingPools.augmented]: T;
}

export interface iBasicDistributionParams {
  receivers: string[];
  percentages: string[];
}

export enum RateMode {
  None = '0',
  Stable = '1',
  Variable = '2',
}

export interface ObjectString {
  [key: string]: string;
}

export interface IProtocolGlobalConfig {
  MockUsdPriceInWei: string;
  UsdAddress: tEthereumAddress;
  NilAddress: tEthereumAddress;
  OneAddress: tEthereumAddress;
}

export interface IMocksConfig {
  AllAssetsInitialPrices: iAssetBase<string>;
}

export interface ILendingRateOracleRatesCommon {
  [token: string]: ILendingRate;
}

export interface ILendingRate {
  borrowRate: string;
}

export interface ICommonConfiguration {
  MarketId: string;
  ProviderId: number;

  Names: ITokenNames;

  ProtocolGlobalParams: IProtocolGlobalConfig;
  Mocks: IMocksConfig;
  ProviderRegistry: iParamsPerNetwork<tEthereumAddress | undefined>;
  ProviderRegistryOwner: iParamsPerNetwork<tEthereumAddress | undefined>;
  ChainlinkAggregator: iParamsPerNetwork<ITokenAddress>;

  LendingRateOracleRatesCommon: iMultiPoolsAssets<IMarketRates>;

  FallbackOracle: iParamsPerNetwork<tEthereumAddress>;

  PoolAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;
  EmergencyAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;

  ReserveAssets: iParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  ReservesConfig: iMultiPoolsAssets<IReserveParams>;
  WETH: iParamsPerNetwork<tEthereumAddress>;

  StakeParams: IStakeParams;

  RewardParams: IRewardParams;

  ForkTest: IForkTest;
}

export interface IAugmentedConfiguration extends ICommonConfiguration {
  //  ReservesConfig: iAugmentedPoolAssets<IReserveParams>;
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
  InitialRate: number;
  TokenPools: iAugmentedPoolAssetsOpt<ITokenRewardPoolParams>;
  TeamPool: ITeamPool;
  ReferralPool?: IReferralPool;
  PermitPool?: IPermitPool;
}

export interface ITeamPool {
  Share: number;
  Manager: tEthereumAddress;
  UnlockAt: Date;
  Members: ITeamMembers;
}

export interface ITeamMembers {
  [address: string]: number;
}

export interface IReferralPool {
  TotalWad: number;
}

export interface IPermitPool {
  TotalWad: number;
}

export interface ITokenRewardPoolParams {
  Share: ITokenTypes<IRewardPoolParams>;
  Scale?: number;
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
}
