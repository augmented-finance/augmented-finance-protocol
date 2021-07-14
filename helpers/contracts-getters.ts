import {
  ProtocolDataProviderFactory,
  DepositTokenFactory,
  ATokensAndRatesHelperFactory,
  OracleRouterFactory,
  DefaultReserveInterestRateStrategyFactory,
  GenericLogicFactory,
  InitializableAdminUpgradeabilityProxyFactory,
  MarketAccessControllerFactory,
  AddressesProviderRegistryFactory,
  LendingPoolCollateralManagerFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingRateOracleFactory,
  MintableERC20Factory,
  MockDepositTokenFactory,
  MockFlashLoanReceiverFactory,
  MockStableDebtTokenFactory,
  MockVariableDebtTokenFactory,
  MockUniswapV2Router02Factory,
  PriceOracleFactory,
  ReserveLogicFactory,
  SelfdestructTransferFactory,
  StableAndVariableTokensHelperFactory,
  StableDebtTokenFactory,
  UniswapLiquiditySwapAdapterFactory,
  UniswapRepayAdapterFactory,
  VariableDebtTokenFactory,
  WalletBalanceProviderFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  FlashLiquidationAdapterFactory,
  RewardFreezerFactory,
  AGFTokenFactory,
  MockAgfTokenFactory,
  MockStakedAgfTokenFactory,
  TeamRewardPoolFactory,
  PermitFreezerRewardPoolFactory,
  AccessControllerFactory,
  DepositToken,
  TokenWeightedRewardPoolFactory,
  RewardBoosterFactory,
  ForwardingRewardPoolFactory,
  XAGFTokenV1Factory,
  RewardedTokenLockerFactory,
  DecayingTokenLockerFactory,
  StakeConfiguratorFactory,
  StakeTokenFactory,
} from '../types';
import { IERC20DetailedFactory } from '../types/IERC20DetailedFactory';
import { MockTokenMap } from './contracts-helpers';
import { DRE, getDb, getFirstSigner } from './misc-utils';
import { eContractid, PoolConfiguration, tEthereumAddress, TokenContractId } from './types';

export const getMarketAddressController = async (address?: tEthereumAddress) =>
  await MarketAccessControllerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MarketAccessController}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getLendingPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await LendingPoolConfiguratorFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolConfigurator}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );
};

export const getLendingPool = async (address?: tEthereumAddress) =>
  await LendingPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPool}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getPriceOracle = async (address?: tEthereumAddress) =>
  await PriceOracleFactory.connect(
    address ||
      (await getDb().get(`${eContractid.PriceOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getAToken = async (address?: tEthereumAddress) =>
  await DepositTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.DepositToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getStableDebtToken = async (address?: tEthereumAddress) =>
  await StableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.StableDebtToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getVariableDebtToken = async (address?: tEthereumAddress) =>
  await VariableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.VariableDebtToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMintableERC20 = async (address: tEthereumAddress) =>
  await MintableERC20Factory.connect(
    address ||
      (await getDb().get(`${eContractid.MintableERC20}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await IERC20DetailedFactory.connect(
    address ||
      (await getDb().get(`${eContractid.IERC20Detailed}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getProtocolDataProvider = async (address?: tEthereumAddress) =>
  await ProtocolDataProviderFactory.connect(
    address ||
      (await getDb().get(`${eContractid.ProtocolDataProvider}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getInterestRateStrategy = async (address?: tEthereumAddress) =>
  await DefaultReserveInterestRateStrategyFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.DefaultReserveInterestRateStrategy}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getMockFlashLoanReceiver = async (address?: tEthereumAddress) =>
  await MockFlashLoanReceiverFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockFlashLoanReceiver}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getLendingRateOracle = async (address?: tEthereumAddress) =>
  await LendingRateOracleFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingRateOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const db = getDb();
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getAllMockedTokens = async () => {
  const db = getDb();
  const tokens: MockTokenMap = await Object.keys(TokenContractId).reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress }
): [string[], string[]] => {
  console.log(allAssetsAddresses);
  const { ETH, USD, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;
  console.log(assetsAddressesWithoutEth);

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    //if (true/*tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH' && tokenSymbol !== 'LpWETH'*/) {
    const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
      (value) => value === tokenSymbol
    );
    const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
      string,
      tEthereumAddress
    ][])[aggregatorAddressIndex];
    return [tokenAddress, aggregatorAddress];
    //}
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const getAddressesProviderRegistry = async (address?: tEthereumAddress) =>
  await AddressesProviderRegistryFactory.connect(
    address ||
      (await getDb().get(`${eContractid.AddressesProviderRegistry}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getReserveLogic = async (address?: tEthereumAddress) =>
  await ReserveLogicFactory.connect(
    address ||
      (await getDb().get(`${eContractid.ReserveLogic}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getGenericLogic = async (address?: tEthereumAddress) =>
  await GenericLogicFactory.connect(
    address ||
      (await getDb().get(`${eContractid.GenericLogic}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getStableAndVariableTokensHelper = async (address?: tEthereumAddress) =>
  await StableAndVariableTokensHelperFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.StableAndVariableTokensHelper}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getATokensAndRatesHelper = async (address?: tEthereumAddress) =>
  await ATokensAndRatesHelperFactory.connect(
    address ||
      (await getDb().get(`${eContractid.ATokensAndRatesHelper}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getWETHGateway = async (address?: tEthereumAddress) =>
  await WETHGatewayFactory.connect(
    address ||
      (await getDb().get(`${eContractid.WETHGateway}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getWETHMocked = async (address?: tEthereumAddress) =>
  await WETH9MockedFactory.connect(
    address || (await getDb().get(`${eContractid.WETHMocked}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockDepositToken = async (address?: tEthereumAddress) =>
  await MockDepositTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockDepositToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockVariableDebtToken = async (address?: tEthereumAddress) =>
  await MockVariableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockVariableDebtToken}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getMockStableDebtToken = async (address?: tEthereumAddress) =>
  await MockStableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockStableDebtToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockAgfToken = async (address?: tEthereumAddress) =>
  await MockAgfTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockAgfToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockStakedAgfToken = async (address?: tEthereumAddress) =>
  await MockStakedAgfTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockStakedAgfToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockStakedAgToken = async (address?: tEthereumAddress) =>
  await MockStakedAgfTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockStakedAgToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getSelfdestructTransferMock = async (address?: tEthereumAddress) =>
  await SelfdestructTransferFactory.connect(
    address ||
      (await getDb().get(`${eContractid.SelfdestructTransferMock}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getProxy = async (address: tEthereumAddress) =>
  await InitializableAdminUpgradeabilityProxyFactory.connect(address, await getFirstSigner());

export const getLendingPoolImpl = async (address?: tEthereumAddress) =>
  await LendingPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolImpl}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getLendingPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  await LendingPoolConfiguratorFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolConfiguratorImpl}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getLendingPoolCollateralManagerImpl = async (address?: tEthereumAddress) =>
  await LendingPoolCollateralManagerFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolCollateralManagerImpl}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getWalletProvider = async (address?: tEthereumAddress) =>
  await WalletBalanceProviderFactory.connect(
    address ||
      (await getDb().get(`${eContractid.WalletBalanceProvider}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getLendingPoolCollateralManager = async (address?: tEthereumAddress) =>
  await LendingPoolCollateralManagerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolCollateralManager}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${DRE.network.name}`).value())?.address || undefined;

export const getOracleRouter = async (address?: tEthereumAddress) =>
  await OracleRouterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.OracleRouter}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockUniswapRouter = async (address?: tEthereumAddress) =>
  await MockUniswapV2Router02Factory.connect(
    address ||
      (await getDb().get(`${eContractid.MockUniswapV2Router02}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getUniswapLiquiditySwapAdapter = async (address?: tEthereumAddress) =>
  await UniswapLiquiditySwapAdapterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.UniswapLiquiditySwapAdapter}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getUniswapRepayAdapter = async (address?: tEthereumAddress) =>
  await UniswapRepayAdapterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.UniswapRepayAdapter}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getFlashLiquidationAdapter = async (address?: tEthereumAddress) =>
  await FlashLiquidationAdapterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.FlashLiquidationAdapter}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getAgfToken = async (address?: tEthereumAddress) =>
  await AGFTokenFactory.connect(
    address || (await getDb().get(`${eContractid.AGFToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getTokenLocker = async (address?: tEthereumAddress) =>
  await RewardedTokenLockerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.TokenLocker}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getDecayingTokenLocker = async (address?: tEthereumAddress) =>
  await DecayingTokenLockerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.DecayingTokenLocker}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getXAgfToken = async (address?: tEthereumAddress) =>
  await XAGFTokenV1Factory.connect(
    address || (await getDb().get(`${eContractid.XAGFToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getTeamRewardPool = async (address?: tEthereumAddress) =>
  await TeamRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.TeamRewardPool}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getForwardingRewardPool = async (address?: tEthereumAddress) =>
  await ForwardingRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.ForwardingRewardPool}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getForwardingRewardPoolDecay = async (address?: tEthereumAddress) =>
  await ForwardingRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.ForwardingRewardPoolDecay}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getRewardController = async (address?: tEthereumAddress) =>
  await RewardFreezerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.RewardController}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getRewardBooster = async (address?: tEthereumAddress) =>
  await RewardBoosterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.RewardBooster}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getPermitFreezerRewardPool = async (address?: tEthereumAddress) =>
  await PermitFreezerRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.PermitFreezerRewardPool}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGF = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.TokenWeightedRewardPoolAGF}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGFBooster = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.TokenWeightedRewardPoolAGFBoosted}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGFSeparate = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.TokenWeightedRewardPoolAGFSeparate}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAG = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.TokenWeightedRewardPoolAG}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGBoosted = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.TokenWeightedRewardPoolAGBoosted}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGUSDCBoosted = async (address?: tEthereumAddress) =>
  await TokenWeightedRewardPoolFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.TokenWeightedRewardPoolAGUSDCBoosted}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getAccessController = async (address?: tEthereumAddress) =>
  await AccessControllerFactory.connect(
    address ||
      (await getDb().get(`${eContractid.AccessController}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getAGTokenByName = async (name: string): Promise<DepositToken> => {
  const dp = await getProtocolDataProvider();
  const tokens = await dp.getAllATokens();
  // console.log(`all deposit tokens: ${tokens}`);
  const addrByName = tokens.filter((v) => v.symbol === name)[0].tokenAddress;
  // console.log(`deposit token addr by name ${name}: ${addrByName}`);
  return await getAToken(addrByName);
};

export const getStakeConfiguratorImpl = async (address?: tEthereumAddress) =>
  await StakeConfiguratorFactory.connect(
    address ||
      (await getDb().get(`${eContractid.StakeConfiguratorImpl}.${DRE.network.name}`).value())
        .address,
    await getFirstSigner()
  );

export const getStakeTokenImpl = async (address?: tEthereumAddress) =>
  await StakeTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.StakeTokenImpl}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );
