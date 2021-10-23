import {
  ProtocolDataProviderFactory,
  DepositTokenFactory,
  OracleRouterFactory,
  GenericLogicFactory,
  MarketAccessControllerFactory,
  AddressesProviderRegistryFactory,
  LendingPoolExtensionFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingRateOracleFactory,
  MintableERC20Factory,
  MockDepositTokenFactory,
  MockFlashLoanReceiverFactory,
  MockStableDebtTokenFactory,
  MockVariableDebtTokenFactory,
  MockUniswapV2Router02Factory,
  ReserveLogicFactory,
  StableDebtTokenFactory,
  UniswapLiquiditySwapAdapterFactory,
  UniswapRepayAdapterFactory,
  VariableDebtTokenFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  FlashLiquidationAdapterFactory,
  RewardFreezerFactory,
  MockAgfTokenFactory,
  MockStakedAgfTokenFactory,
  TeamRewardPoolFactory,
  PermitFreezerRewardPoolFactory,
  DepositToken,
  TokenWeightedRewardPoolFactory,
  RewardBoosterFactory,
  RewardedTokenLockerFactory,
  DecayingTokenLockerFactory,
  StakeConfiguratorFactory,
  StakeTokenFactory,
  RewardConfiguratorFactory,
  MockPriceOracleFactory,
  XAGFTokenV1Factory,
  AGFTokenV1Factory,
  TreasuryFactory,
  ReferralRewardPoolFactory,
  MockLendingPoolFactory,
  DelegatedStrategyAaveFactory,
  DelegatedStrategyCompoundErc20Factory,
  DelegatedStrategyCompoundEthFactory,
  StaticPriceOracleFactory,
  TreasuryRewardPoolFactory,
  DelegationAwareDepositTokenFactory,
  DefaultReserveInterestRateStrategyFactory,
  MockDepositStakeTokenFactory,
  DepositStakeTokenFactory,
  PriceFeedUniEthPairFactory,
  PriceFeedUniEthTokenFactory,
  ProxyAdminFactory,
} from '../types';
import { IManagedRewardPoolFactory } from '../types/IManagedRewardPoolFactory';
import { IRewardedTokenFactory } from '../types/IRewardedTokenFactory';
import { IERC20DetailedFactory } from '../types/IERC20DetailedFactory';

import { MockTokenMap } from './contracts-helpers';
import { falsyOrZeroAddress, getFirstSigner, getFromJsonDb, hasInJsonDb } from './misc-utils';
import { DefaultTokenSymbols, eContractid, PoolConfiguration, tEthereumAddress } from './types';
import { ILendingPoolAaveCompatibleFactory } from '../types/ILendingPoolAaveCompatibleFactory';
import { IManagedLendingPoolFactory } from '../types/IManagedLendingPoolFactory';
import { IAaveLendingPoolFactory } from '../types/IAaveLendingPoolFactory';
import { IPriceOracleGetterFactory } from '../types/IPriceOracleGetterFactory';
import { IChainlinkAggregatorFactory } from '../types/IChainlinkAggregatorFactory';
import { IInitializablePoolTokenFactory } from '../types/IInitializablePoolTokenFactory';
import { IInitializableStakeTokenFactory } from '../types/IInitializableStakeTokenFactory';
import { IInitializableRewardPoolFactory } from '../types/IInitializableRewardPoolFactory';
import { IReserveDelegatedStrategyFactory } from '../types/IReserveDelegatedStrategyFactory';
import { PriceFeedCompoundEthFactory } from '../types/PriceFeedCompoundEthFactory';
import { PriceFeedCompoundErc20Factory } from '../types/PriceFeedCompoundErc20Factory';
import { IWETHGatewayFactory } from '../types/IWETHGatewayFactory';
import { IInitializableRewardTokenFactory } from '../types/IInitializableRewardTokenFactory';
import { IUniswapV2Router02Factory } from '../types/IUniswapV2Router02Factory';
import { IUniswapV2FactoryFactory } from '../types/IUniswapV2FactoryFactory';
import { IUniswapV2PairFactory } from '../types/IUniswapV2PairFactory';

const getAddr = async (id: eContractid) => {
  const entry = await getFromJsonDb(id);
  if (falsyOrZeroAddress(entry?.address)) {
    throw 'unknown named address: ' + id;
  }
  return entry!.address;
};

export const getMarketAddressController = async (address?: tEthereumAddress) =>
  MarketAccessControllerFactory.connect(
    address || (await getAddr(eContractid.MarketAccessController)),
    await getFirstSigner()
  );

export const hasMarketAddressController = () => hasInJsonDb(eContractid.MarketAccessController);

export const getPreDeployedAddressController = async () =>
  MarketAccessControllerFactory.connect(
    await getAddr(eContractid.PreDeployedMarketAccessController),
    await getFirstSigner()
  );

export const hasPreDeployedAddressController = () => hasInJsonDb(eContractid.PreDeployedMarketAccessController);

export const getLendingPoolConfiguratorProxy = async (address: tEthereumAddress) => {
  return LendingPoolConfiguratorFactory.connect(address, await getFirstSigner());
};

export const getLendingPoolProxy = async (address: tEthereumAddress) =>
  LendingPoolFactory.connect(address, await getFirstSigner());

export const getMockPriceOracle = async (address: tEthereumAddress) =>
  MockPriceOracleFactory.connect(address, await getFirstSigner());

export const getDepositToken = async (address: tEthereumAddress) =>
  DepositTokenFactory.connect(address, await getFirstSigner());

export const getDelegationAwareDepositToken = async (address: tEthereumAddress) =>
  DelegationAwareDepositTokenFactory.connect(address, await getFirstSigner());

export const getStableDebtToken = async (address: tEthereumAddress) =>
  StableDebtTokenFactory.connect(address, await getFirstSigner());

export const getVariableDebtToken = async (address: tEthereumAddress) =>
  VariableDebtTokenFactory.connect(address, await getFirstSigner());

export const getMintableERC20 = async (address: tEthereumAddress) =>
  MintableERC20Factory.connect(address, await getFirstSigner());

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  IERC20DetailedFactory.connect(address, await getFirstSigner());

export const getIReserveDelegatedStrategy = async (address: tEthereumAddress) =>
  IReserveDelegatedStrategyFactory.connect(address, await getFirstSigner());

export const getIRewardedToken = async (address: tEthereumAddress) =>
  IRewardedTokenFactory.connect(address, await getFirstSigner());

export const getIUniswapV2Router02 = async (address: tEthereumAddress) =>
  IUniswapV2Router02Factory.connect(address, await getFirstSigner());

export const getIUniswapV2Factory = async (address: tEthereumAddress) =>
  IUniswapV2FactoryFactory.connect(address, await getFirstSigner());

export const getIUniswapV2Pair = async (address: tEthereumAddress) =>
  IUniswapV2PairFactory.connect(address, await getFirstSigner());

export const getRewardConfiguratorProxy = async (address: tEthereumAddress) =>
  RewardConfiguratorFactory.connect(address, await getFirstSigner());

export const getProtocolDataProvider = async (address?: tEthereumAddress) =>
  ProtocolDataProviderFactory.connect(
    address || (await getAddr(eContractid.ProtocolDataProvider)),
    await getFirstSigner()
  );

export const getMockFlashLoanReceiver = async (address?: tEthereumAddress) =>
  MockFlashLoanReceiverFactory.connect(
    address || (await getAddr(eContractid.MockFlashLoanReceiver)),
    await getFirstSigner()
  );

export const getLendingRateOracle = async (address?: tEthereumAddress) =>
  LendingRateOracleFactory.connect(address || (await getAddr(eContractid.LendingRateOracle)), await getFirstSigner());

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = (await getFromJsonDb(tokenSymbol.toUpperCase())).address;
    accumulator[tokenSymbol] = await getMintableERC20(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getAllMockedTokens = async () => {
  const tokens: MockTokenMap = await DefaultTokenSymbols.reduce<Promise<MockTokenMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = (await getFromJsonDb(tokenSymbol.toUpperCase())).address;
    accumulator[tokenSymbol] = await getMintableERC20(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getTokenAggregatorPairs = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorAddresses: { [tokenSymbol: string]: tEthereumAddress }
): [string[], string[]] => {
  console.log(allAssetsAddresses);
  console.log(aggregatorAddresses);
  if (aggregatorAddresses == undefined) {
    return [[], []];
  }
  const { ETH, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;
  console.log(assetsAddressesWithoutEth);

  const assets: string[] = [];
  const aggregators: string[] = [];

  for (const [tokenSymbol, tokenAddress] of Object.entries(assetsAddressesWithoutEth)) {
    if (falsyOrZeroAddress(tokenAddress)) {
      continue;
    }
    const aggregatorAddress = aggregatorAddresses[tokenSymbol];
    if (falsyOrZeroAddress(aggregatorAddress)) {
      continue;
    }
    assets.push(tokenAddress);
    aggregators.push(aggregatorAddress);
  }

  return [assets, aggregators];
};

export const getAddressesProviderRegistry = async (address?: tEthereumAddress) =>
  AddressesProviderRegistryFactory.connect(
    address || (await getAddr(eContractid.AddressesProviderRegistry)),
    await getFirstSigner()
  );

export const hasAddressProviderRegistry = () => hasInJsonDb(eContractid.AddressesProviderRegistry);

export const getReserveLogic = async (address?: tEthereumAddress) =>
  ReserveLogicFactory.connect(address || (await getAddr(eContractid.ReserveLogic)), await getFirstSigner());

export const getGenericLogic = async (address?: tEthereumAddress) =>
  GenericLogicFactory.connect(address || (await getAddr(eContractid.GenericLogic)), await getFirstSigner());

export const getWETHGateway = async (address?: tEthereumAddress) =>
  WETHGatewayFactory.connect(address || (await getAddr(eContractid.WETHGateway)), await getFirstSigner());

export const getIWETHGateway = async (address: tEthereumAddress) =>
  IWETHGatewayFactory.connect(address, await getFirstSigner());

export const getWETHMocked = async (address: tEthereumAddress) =>
  WETH9MockedFactory.connect(address, await getFirstSigner());

export const getMockDepositToken = async (address?: tEthereumAddress) =>
  MockDepositTokenFactory.connect(address || (await getAddr(eContractid.MockDepositToken)), await getFirstSigner());

export const getMockVariableDebtToken = async (address?: tEthereumAddress) =>
  MockVariableDebtTokenFactory.connect(
    address || (await getAddr(eContractid.MockVariableDebtToken)),
    await getFirstSigner()
  );

export const getMockStableDebtToken = async (address?: tEthereumAddress) =>
  MockStableDebtTokenFactory.connect(
    address || (await getAddr(eContractid.MockStableDebtToken)),
    await getFirstSigner()
  );

export const getMockAgfToken = async (address?: tEthereumAddress) =>
  MockAgfTokenFactory.connect(address || (await getAddr(eContractid.MockAgfToken)), await getFirstSigner());

export const getMockStakedAgfToken = async (address?: tEthereumAddress) =>
  MockStakedAgfTokenFactory.connect(address || (await getAddr(eContractid.MockStakedAgfToken)), await getFirstSigner());

export const getMockLendingPoolImpl = async (address?: tEthereumAddress) =>
  MockLendingPoolFactory.connect(address || (await getAddr(eContractid.LendingPoolImpl)), await getFirstSigner());

export const getLendingPoolImpl = async (address?: tEthereumAddress) =>
  LendingPoolFactory.connect(address || (await getAddr(eContractid.LendingPoolImpl)), await getFirstSigner());

export const getLendingPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  LendingPoolConfiguratorFactory.connect(
    address || (await getAddr(eContractid.LendingPoolConfiguratorImpl)),
    await getFirstSigner()
  );

export const getLendingPoolExtensionImpl = async (address?: tEthereumAddress) =>
  LendingPoolExtensionFactory.connect(
    address || (await getAddr(eContractid.LendingPoolExtensionImpl)),
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getFromJsonDb(id))?.address || undefined;

export const getOracleRouter = async (address?: tEthereumAddress) =>
  OracleRouterFactory.connect(address || (await getAddr(eContractid.OracleRouter)), await getFirstSigner());

export const getMockUniswapRouter = async (address?: tEthereumAddress) =>
  MockUniswapV2Router02Factory.connect(
    address || (await getAddr(eContractid.MockUniswapV2Router02)),
    await getFirstSigner()
  );

export const getUniswapLiquiditySwapAdapter = async (address?: tEthereumAddress) =>
  UniswapLiquiditySwapAdapterFactory.connect(
    address || (await getAddr(eContractid.UniswapLiquiditySwapAdapter)),
    await getFirstSigner()
  );

export const getUniswapRepayAdapter = async (address?: tEthereumAddress) =>
  UniswapRepayAdapterFactory.connect(
    address || (await getAddr(eContractid.UniswapRepayAdapter)),
    await getFirstSigner()
  );

export const getFlashLiquidationAdapter = async (address?: tEthereumAddress) =>
  FlashLiquidationAdapterFactory.connect(
    address || (await getAddr(eContractid.FlashLiquidationAdapter)),
    await getFirstSigner()
  );

export const getMockTokenLocker = async (address?: tEthereumAddress) =>
  RewardedTokenLockerFactory.connect(address || (await getAddr(eContractid.MockTokenLocker)), await getFirstSigner());

export const getMockDecayingTokenLocker = async (address?: tEthereumAddress) =>
  DecayingTokenLockerFactory.connect(
    address || (await getAddr(eContractid.MockDecayingTokenLocker)),
    await getFirstSigner()
  );

export const getDecayingTokenLockerProxy = async (address: tEthereumAddress) =>
  DecayingTokenLockerFactory.connect(address, await getFirstSigner());

export const getTeamRewardPool = async (address?: tEthereumAddress) =>
  TeamRewardPoolFactory.connect(address || (await getAddr(eContractid.TeamRewardPool)), await getFirstSigner());

export const getTreasuryProxy = async (address: tEthereumAddress) =>
  TreasuryFactory.connect(address, await getFirstSigner());

export const getMockRewardFreezer = async (address?: tEthereumAddress) =>
  RewardFreezerFactory.connect(address || (await getAddr(eContractid.MockRewardFreezer)), await getFirstSigner());

export const getMockRewardBooster = async (address?: tEthereumAddress) =>
  RewardBoosterFactory.connect(address || (await getAddr(eContractid.MockRewardBooster)), await getFirstSigner());

export const getRewardBooster = async (address: tEthereumAddress) =>
  RewardBoosterFactory.connect(address, await getFirstSigner());

export const getPermitFreezerRewardPool = async (address?: tEthereumAddress) =>
  PermitFreezerRewardPoolFactory.connect(
    address || (await getAddr(eContractid.PermitFreezerRewardPool)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPool = async (address: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(address, await getFirstSigner());

export const getTokenWeightedRewardPoolAGFBooster = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAGFBoosted)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGFSeparate = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAGFSeparate)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAG = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAG)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGBoosted = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAGBoosted)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGUSDCBoosted = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAGUSDCBoosted)),
    await getFirstSigner()
  );

export const getMockReferralRewardPool = async (address?: tEthereumAddress) =>
  ReferralRewardPoolFactory.connect(
    address || (await getAddr(eContractid.MockReferralRewardPool)),
    await getFirstSigner()
  );

export const getMarketAccessController = async (address?: tEthereumAddress) =>
  MarketAccessControllerFactory.connect(
    address || (await getAddr(eContractid.MarketAccessController)),
    await getFirstSigner()
  );

export const getAGTokenByName = async (name: string): Promise<DepositToken> => {
  const dp = await getProtocolDataProvider();
  const tokens = (await dp.getAllTokenDescriptions(false)).tokens;
  // console.log(`all deposit tokens: ${tokens}`);
  const addrByName = tokens.filter((v) => v.tokenSymbol === name)[0].token;
  // console.log(`deposit token addr by name ${name}: ${addrByName}`);
  return await getDepositToken(addrByName);
};

export const getStakeConfiguratorImpl = async (address: tEthereumAddress) =>
  StakeConfiguratorFactory.connect(address, await getFirstSigner());

export const getProxyAdmin = async (address: tEthereumAddress) =>
  ProxyAdminFactory.connect(address, await getFirstSigner());

export const getStakeTokenImpl = async (address: tEthereumAddress) =>
  StakeTokenFactory.connect(address, await getFirstSigner());

export const getXAGFTokenV1Impl = async (address: tEthereumAddress) =>
  XAGFTokenV1Factory.connect(address, await getFirstSigner());

export const getAGFTokenV1Impl = async (address: tEthereumAddress) =>
  AGFTokenV1Factory.connect(address, await getFirstSigner());

export const getIManagedRewardPool = async (address: tEthereumAddress) =>
  IManagedRewardPoolFactory.connect(address, await getFirstSigner());

export const getILendingPoolAaveCompatible = async (address: tEthereumAddress) =>
  ILendingPoolAaveCompatibleFactory.connect(address, await getFirstSigner());

export const getIAaveLendingPool = async (address: tEthereumAddress) =>
  IAaveLendingPoolFactory.connect(address, await getFirstSigner());

export const getIPriceOracleGetter = async (address: tEthereumAddress) =>
  IPriceOracleGetterFactory.connect(address, await getFirstSigner());

export const getIChainlinkAggregator = async (address: tEthereumAddress) =>
  IChainlinkAggregatorFactory.connect(address, await getFirstSigner());

export const getIManagedLendingPool = async (address: tEthereumAddress) =>
  IManagedLendingPoolFactory.connect(address, await getFirstSigner());

export const getIInitializablePoolToken = async (address: tEthereumAddress) =>
  IInitializablePoolTokenFactory.connect(address, await getFirstSigner());

export const getIInitializableStakeToken = async (address: tEthereumAddress) =>
  IInitializableStakeTokenFactory.connect(address, await getFirstSigner());

export const getIInitializableRewardPool = async (address: tEthereumAddress) =>
  IInitializableRewardPoolFactory.connect(address, await getFirstSigner());

export const getIInitializableRewardToken = async (address: tEthereumAddress) =>
  IInitializableRewardTokenFactory.connect(address, await getFirstSigner());

export const getDelegatedStrategyAave = async (address?: tEthereumAddress) =>
  DelegatedStrategyAaveFactory.connect(
    address || (await getAddr(eContractid.DelegatedStrategyAave)),
    await getFirstSigner()
  );

export const getDelegatedStrategyCompoundErc20 = async (address?: tEthereumAddress) =>
  DelegatedStrategyCompoundErc20Factory.connect(
    address || (await getAddr(eContractid.DelegatedStrategyCompoundErc20)),
    await getFirstSigner()
  );

export const getDelegatedStrategyCompoundEth = async (address?: tEthereumAddress) =>
  DelegatedStrategyCompoundEthFactory.connect(
    address || (await getAddr(eContractid.DelegatedStrategyCompoundEth)),
    await getFirstSigner()
  );

export const getStaticPriceOracle = async (address?: tEthereumAddress) =>
  StaticPriceOracleFactory.connect(address || (await getAddr(eContractid.StaticPriceOracle)), await getFirstSigner());

export const getTreasuryRewardPool = async (address?: tEthereumAddress) =>
  TreasuryRewardPoolFactory.connect(address || (await getAddr(eContractid.TreasuryRewardPool)), await getFirstSigner());

export const getReferralRewardPoolImpl = async (address: tEthereumAddress) =>
  ReferralRewardPoolFactory.connect(
    address || (await getAddr(eContractid.ReferralRewardPoolV1Impl)),
    await getFirstSigner()
  );

export const getDefaultReserveInterestRateStrategy = async (address: tEthereumAddress) =>
  DefaultReserveInterestRateStrategyFactory.connect(
    address || (await getAddr(eContractid.DefaultReserveInterestRateStrategy)),
    await getFirstSigner()
  );

export const getMockDepositStakeToken = async (address?: tEthereumAddress) =>
  MockDepositStakeTokenFactory.connect(
    address || (await getAddr(eContractid.MockDepositStakeToken)),
    await getFirstSigner()
  );

export const getDepositStakeTokenImpl = async (address: tEthereumAddress) =>
  DepositStakeTokenFactory.connect(address, await getFirstSigner());

export const getPriceFeedCompoundEth = async (address?: tEthereumAddress) =>
  PriceFeedCompoundEthFactory.connect(
    address || (await getAddr(eContractid.PriceFeedCompoundEth)),
    await getFirstSigner()
  );

export const getPriceFeedCompoundErc20 = async (address?: tEthereumAddress) =>
  PriceFeedCompoundErc20Factory.connect(
    address || (await getAddr(eContractid.PriceFeedCompoundErc20)),
    await getFirstSigner()
  );

export const getPriceFeedUniEthPair = async (address?: tEthereumAddress) =>
  PriceFeedUniEthPairFactory.connect(
    address || (await getAddr(eContractid.PriceFeedUniEthPair)),
    await getFirstSigner()
  );

export const getPriceFeedUniEthToken = async (address?: tEthereumAddress) =>
  PriceFeedUniEthTokenFactory.connect(
    address || (await getAddr(eContractid.PriceFeedUniEthToken)),
    await getFirstSigner()
  );
