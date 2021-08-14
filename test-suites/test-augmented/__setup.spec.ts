import rawBRE from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import { getEthersSigners, registerContractInJsonDb } from '../../helpers/contracts-helpers';
import {
  deployMarketAccessController,
  deployMintableERC20,
  deployAddressesProviderRegistry,
  deployMockPriceOracle,
  deployOracleRouter,
  deployMockFlashLoanReceiver,
  deployProtocolDataProvider,
  deployLendingRateOracle,
  deployWETHGateway,
  deployWETHMocked,
  deployMockUniswapRouter,
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
  deployFlashLiquidationAdapter,
  deployTreasuryImpl,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolExtensionImpl,
  deployMockLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { Signer } from 'ethers';
import { DefaultTokenSymbols, tEthereumAddress } from '../../helpers/types';
import { MintableERC20 } from '../../types';
import { ConfigNames, getReservesTestConfig, loadPoolConfig } from '../../helpers/configuration';
import { initializeMakeSuite } from './helpers/make-suite';

import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import { DRE, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import { getLendingPoolProxy, getTokenAggregatorPairs } from '../../helpers/contracts-getters';
import { WETH9Mocked } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';
import { TestConfig } from '../../markets/augmented';

const deployConfig = TestConfig;
const MOCK_USD_PRICE_IN_WEI = deployConfig.Mocks.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = deployConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = deployConfig.Mocks.UsdAddress;
const MOCK_CHAINLINK_AGGREGATORS_PRICES = deployConfig.Mocks.AllAssetsInitialPrices;
const LENDING_RATE_ORACLE_RATES = deployConfig.LendingRateOracleRates;

const deployAllMockTokens = async (deployer: Signer) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 | WETH9Mocked } = {};

  const protoConfigData = getReservesTestConfig();

  for (const tokenSymbol of DefaultTokenSymbols) {
    if (tokenSymbol === 'WETH') {
      tokens[tokenSymbol] = await deployWETHMocked();
      await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
      continue;
    }
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (!configData) {
      decimals = 18;
    }

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }

  return tokens;
};

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');

  const mockTokens = await deployAllMockTokens(deployer);
  console.log('Deployed mocks');
  const addressProvider = await deployMarketAccessController(deployConfig.MarketId);
  await addressProvider.setAnyRoleMode(true);
  await addressProvider.grantRoles(await deployer.getAddress(), AccessFlags.POOL_ADMIN);

  //setting users[1] as emergency admin, which is in position 2 in the DRE addresses list
  const addressList = await Promise.all((await (<any>DRE).ethers.getSigners()).map((signer) => signer.getAddress()));

  await addressProvider.grantRoles(<string>addressList[2], AccessFlags.EMERGENCY_ADMIN);

  const addressesProviderRegistry = await deployAddressesProviderRegistry();
  await addressesProviderRegistry.registerAddressesProvider(addressProvider.address, 1);

  const lendingPoolImpl = await deployMockLendingPoolImpl();

  await waitForTx(await addressProvider.setAddressAsProxy(AccessFlags.LENDING_POOL, lendingPoolImpl.address));

  const lendingPoolAddress = await addressProvider.getLendingPool();
  const lendingPoolProxy = await getLendingPoolProxy(lendingPoolAddress);

  const poolExtensionImpl = await deployLendingPoolExtensionImpl(false, false);
  console.log('\tSetting lending pool collateral manager implementation with address', poolExtensionImpl.address);
  await lendingPoolProxy.setLendingPoolExtension(poolExtensionImpl.address);

  const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(false, false);
  await addressProvider.setAddressAsProxy(AccessFlags.LENDING_POOL_CONFIGURATOR, lendingPoolConfiguratorImpl.address);

  const fallbackOracle = await deployMockPriceOracle();

  await waitForTx(await fallbackOracle.setEthUsdPrice(MOCK_USD_PRICE_IN_WEI));
  await setInitialAssetPricesInOracle(
    ALL_ASSETS_INITIAL_PRICES,
    {
      WETH: mockTokens.WETH.address,
      DAI: mockTokens.DAI.address,
      USDC: mockTokens.USDC.address,
      USDT: mockTokens.USDT.address,
      AAVE: mockTokens.AAVE.address,
      WBTC: mockTokens.WBTC.address,
      LINK: mockTokens.LINK.address,
      USD: USD_ADDRESS,
    },
    fallbackOracle
  );

  const mockAggregators = await deployAllMockAggregators(MOCK_CHAINLINK_AGGREGATORS_PRICES);
  console.log('Mock aggs deployed');
  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );

  const [tokens, aggregators] = getTokenAggregatorPairs(allTokenAddresses, allAggregatorsAddresses);

  await deployOracleRouter([
    addressProvider.address,
    tokens,
    aggregators,
    fallbackOracle.address,
    mockTokens.WETH.address,
  ]);

  const lendingRateOracle = await deployLendingRateOracle([addressProvider.address]);

  await addressProvider.grantRoles(
    await deployer.getAddress(),
    AccessFlags.LENDING_RATE_ADMIN | AccessFlags.ORACLE_ADMIN
  );

  const { USD, ...tokensAddressesWithoutUsd } = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };
  await setInitialMarketRatesInRatesOracleByHelper(LENDING_RATE_ORACLE_RATES, allReservesAddresses, lendingRateOracle);

  await addressProvider.setAddress(AccessFlags.PRICE_ORACLE, fallbackOracle.address);
  await addressProvider.setAddress(AccessFlags.LENDING_RATE_ORACLE, lendingRateOracle.address);

  const reservesParams = getReservesTestConfig();

  const testHelpers = await deployProtocolDataProvider(addressProvider.address);

  console.log('Initialize configuration');

  const config = loadPoolConfig(ConfigNames.Test);

  const { Names } = config;

  const treasuryImpl = await deployTreasuryImpl(false, false);
  await addressProvider.setAddressAsProxy(AccessFlags.TREASURY, treasuryImpl.address);

  await initReservesByHelper(addressProvider, reservesParams, allReservesAddresses, Names, false, false);

  await configureReservesByHelper(addressProvider, reservesParams, allReservesAddresses, testHelpers);

  await deployMockFlashLoanReceiver(addressProvider.address);

  const mockUniswapRouter = await deployMockUniswapRouter();

  const adapterParams: [string, string, string] = [
    addressProvider.address,
    mockUniswapRouter.address,
    mockTokens.WETH.address,
  ];

  await deployUniswapLiquiditySwapAdapter(adapterParams);
  await deployUniswapRepayAdapter(adapterParams);
  await deployFlashLiquidationAdapter(adapterParams);

  await deployWETHGateway([addressProvider.address, mockTokens.WETH.address]);

  console.timeEnd('setup');
};

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, secondaryWallet] = await getEthersSigners();

  if (process.env.MAINNET_FORK === 'true') {
    await rawBRE.run('augmented:dev'); // TODO: augmented:main ??
  } else {
    console.log('-> Deploying test environment...');
    await buildTestEnv(deployer, secondaryWallet);
  }

  await initializeMakeSuite();
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
