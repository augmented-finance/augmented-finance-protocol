import {
  ProtocolDataProviderFactory,
  DepositTokenFactory,
  OracleRouterFactory,
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
  StableDebtTokenFactory,
  UniswapLiquiditySwapAdapterFactory,
  UniswapRepayAdapterFactory,
  VariableDebtTokenFactory,
  WalletBalanceProviderFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  FlashLiquidationAdapterFactory,
  RewardFreezerFactory,
  AGFTokenV1Factory,
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
import { getFirstSigner, getFromJsonDb } from './misc-utils';
import { eContractid, PoolConfiguration, tEthereumAddress, TokenContractId } from './types';

const getAddr = async (id: eContractid) => (await getFromJsonDb(id)).address;

export const getMarketAddressController = async (address?: tEthereumAddress) =>
  MarketAccessControllerFactory.connect(
    address || (await getAddr(eContractid.MarketAccessController)),
    await getFirstSigner()
  );

export const getLendingPoolConfiguratorProxy = async (address: tEthereumAddress) => {
  return LendingPoolConfiguratorFactory.connect(address, await getFirstSigner());
};

export const getLendingPoolProxy = async (address: tEthereumAddress) =>
  LendingPoolFactory.connect(address, await getFirstSigner());

export const getPriceOracle = async (address: tEthereumAddress) =>
  PriceOracleFactory.connect(address, await getFirstSigner());

export const getDepositToken = async (address: tEthereumAddress) =>
  DepositTokenFactory.connect(address, await getFirstSigner());

export const getStableDebtToken = async (address: tEthereumAddress) =>
  StableDebtTokenFactory.connect(address, await getFirstSigner());

export const getVariableDebtToken = async (address: tEthereumAddress) =>
  VariableDebtTokenFactory.connect(address, await getFirstSigner());

export const getMintableERC20 = async (address: tEthereumAddress) =>
  MintableERC20Factory.connect(address, await getFirstSigner());

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  IERC20DetailedFactory.connect(address, await getFirstSigner());

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
  LendingRateOracleFactory.connect(
    address || (await getAddr(eContractid.LendingRateOracle)),
    await getFirstSigner()
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = (await getFromJsonDb(tokenSymbol.toUpperCase())).address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getAllMockedTokens = async () => {
  const tokens: MockTokenMap = await Object.keys(TokenContractId).reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = (await getFromJsonDb(tokenSymbol.toUpperCase())).address;
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
  AddressesProviderRegistryFactory.connect(
    address || (await getAddr(eContractid.AddressesProviderRegistry)),
    await getFirstSigner()
  );

export const getReserveLogic = async (address?: tEthereumAddress) =>
  ReserveLogicFactory.connect(
    address || (await getAddr(eContractid.ReserveLogic)),
    await getFirstSigner()
  );

export const getGenericLogic = async (address?: tEthereumAddress) =>
  GenericLogicFactory.connect(
    address || (await getAddr(eContractid.GenericLogic)),
    await getFirstSigner()
  );

export const getWETHGateway = async (address?: tEthereumAddress) =>
  WETHGatewayFactory.connect(
    address || (await getAddr(eContractid.WETHGateway)),
    await getFirstSigner()
  );

export const getWETHMocked = async (address: tEthereumAddress) =>
  WETH9MockedFactory.connect(address, await getFirstSigner());

export const getMockDepositToken = async (address?: tEthereumAddress) =>
  MockDepositTokenFactory.connect(
    address || (await getAddr(eContractid.MockDepositToken)),
    await getFirstSigner()
  );

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
  MockAgfTokenFactory.connect(
    address || (await getAddr(eContractid.MockAgfToken)),
    await getFirstSigner()
  );

export const getMockStakedAgfToken = async (address?: tEthereumAddress) =>
  MockStakedAgfTokenFactory.connect(
    address || (await getAddr(eContractid.MockStakedAgfToken)),
    await getFirstSigner()
  );

export const getMockStakedAgToken = async (address?: tEthereumAddress) =>
  MockStakedAgfTokenFactory.connect(
    address || (await getAddr(eContractid.MockStakedAgToken)),
    await getFirstSigner()
  );

export const getSelfdestructTransferMock = async (address?: tEthereumAddress) =>
  SelfdestructTransferFactory.connect(
    address || (await getAddr(eContractid.SelfdestructTransferMock)),
    await getFirstSigner()
  );

export const getProxy = async (address: tEthereumAddress) =>
  InitializableAdminUpgradeabilityProxyFactory.connect(address, await getFirstSigner());

export const getLendingPoolImpl = async (address?: tEthereumAddress) =>
  LendingPoolFactory.connect(
    address || (await getAddr(eContractid.LendingPoolImpl)),
    await getFirstSigner()
  );

export const getLendingPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  LendingPoolConfiguratorFactory.connect(
    address || (await getAddr(eContractid.LendingPoolConfiguratorImpl)),
    await getFirstSigner()
  );

export const getLendingPoolCollateralManagerImpl = async (address?: tEthereumAddress) =>
  LendingPoolCollateralManagerFactory.connect(
    address || (await getAddr(eContractid.LendingPoolCollateralManagerImpl)),
    await getFirstSigner()
  );

export const getWalletProvider = async (address?: tEthereumAddress) =>
  WalletBalanceProviderFactory.connect(
    address || (await getAddr(eContractid.WalletBalanceProvider)),
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getFromJsonDb(id))?.address || undefined;

export const getOracleRouter = async (address?: tEthereumAddress) =>
  OracleRouterFactory.connect(
    address || (await getAddr(eContractid.OracleRouter)),
    await getFirstSigner()
  );

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

export const getAgfToken = async (address?: tEthereumAddress) =>
  AGFTokenV1Factory.connect(
    address || (await getAddr(eContractid.AGFToken)),
    await getFirstSigner()
  );

export const getTokenLocker = async (address?: tEthereumAddress) =>
  RewardedTokenLockerFactory.connect(
    address || (await getAddr(eContractid.TokenLocker)),
    await getFirstSigner()
  );

export const getDecayingTokenLocker = async (address?: tEthereumAddress) =>
  DecayingTokenLockerFactory.connect(
    address || (await getAddr(eContractid.DecayingTokenLocker)),
    await getFirstSigner()
  );

export const getTeamRewardPool = async (address?: tEthereumAddress) =>
  TeamRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TeamRewardPool)),
    await getFirstSigner()
  );

export const getForwardingRewardPool = async (address?: tEthereumAddress) =>
  ForwardingRewardPoolFactory.connect(
    address || (await getAddr(eContractid.ForwardingRewardPool)),
    await getFirstSigner()
  );

export const getForwardingRewardPoolDecay = async (address?: tEthereumAddress) =>
  ForwardingRewardPoolFactory.connect(
    address || (await getAddr(eContractid.ForwardingRewardPoolDecay)),
    await getFirstSigner()
  );

export const getRewardController = async (address?: tEthereumAddress) =>
  RewardFreezerFactory.connect(
    address || (await getAddr(eContractid.RewardController)),
    await getFirstSigner()
  );

export const getRewardBooster = async (address?: tEthereumAddress) =>
  RewardBoosterFactory.connect(
    address || (await getAddr(eContractid.RewardBooster)),
    await getFirstSigner()
  );

export const getPermitFreezerRewardPool = async (address?: tEthereumAddress) =>
  PermitFreezerRewardPoolFactory.connect(
    address || (await getAddr(eContractid.PermitFreezerRewardPool)),
    await getFirstSigner()
  );

export const getTokenWeightedRewardPoolAGF = async (address?: tEthereumAddress) =>
  TokenWeightedRewardPoolFactory.connect(
    address || (await getAddr(eContractid.TokenWeightedRewardPoolAGF)),
    await getFirstSigner()
  );

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

export const getMarketAccessController = async (address?: tEthereumAddress) =>
  AccessControllerFactory.connect(
    address || (await getAddr(eContractid.MarketAccessController)),
    await getFirstSigner()
  );

export const getAGTokenByName = async (name: string): Promise<DepositToken> => {
  const dp = await getProtocolDataProvider();
  const tokens = await dp.getAllATokens();
  // console.log(`all deposit tokens: ${tokens}`);
  const addrByName = tokens.filter((v) => v.symbol === name)[0].tokenAddress;
  // console.log(`deposit token addr by name ${name}: ${addrByName}`);
  return await getDepositToken(addrByName);
};

export const getStakeConfiguratorImpl = async (address?: tEthereumAddress) =>
  StakeConfiguratorFactory.connect(
    address || (await getAddr(eContractid.StakeConfiguratorImpl)),
    await getFirstSigner()
  );

export const getStakeTokenImpl = async (address?: tEthereumAddress) =>
  StakeTokenFactory.connect(
    address || (await getAddr(eContractid.StakeTokenImpl)),
    await getFirstSigner()
  );

export const getXAgfToken = async (address?: tEthereumAddress) =>
  XAGFTokenV1Factory.connect(
    address || (await getAddr(eContractid.XAGFToken)),
    await getFirstSigner()
  );
