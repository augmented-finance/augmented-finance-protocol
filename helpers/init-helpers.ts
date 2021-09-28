import { eContractid, IInterestRateStrategyParams, IReserveParams, ITokenNames, tEthereumAddress } from './types';
import { ProtocolDataProvider } from '../types/ProtocolDataProvider';
import { addProxyToJsonDb, chunk, falsyOrZeroAddress, mustWaitTx, waitForTx } from './misc-utils';
import {
  getIChainlinkAggregator,
  getIInitializablePoolToken,
  getIReserveDelegatedStrategy,
  getIUniswapV2Factory,
  getIUniswapV2Router02,
  getLendingPoolConfiguratorProxy,
  getLendingPoolProxy,
  getOracleRouter,
  getStaticPriceOracle,
  getWETHGateway,
} from './contracts-getters';
import { AccessFlags } from './access-flags';
import {
  deployDelegatedStrategyAave,
  deployDelegatedStrategyCompoundErc20,
  deployDelegatedStrategyCompoundEth,
  deployDelegationAwareDepositToken,
  deployDelegationAwareDepositTokenImpl,
  deployDepositToken,
  deployDepositTokenImpl,
  deployPriceFeedCompoundErc20,
  deployPriceFeedCompoundEth,
  deployReserveInterestRateStrategy,
  deployStableDebtTokenImpl,
  deployVariableDebtTokenImpl,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';
import { MarketAccessController, OracleRouter } from '../types';
import { Contract } from '@ethersproject/contracts';
import { waitForAddressFn } from './deploy-helpers';

export const chooseDepositTokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.DepositTokenImpl:
      return deployDepositToken;
    case eContractid.DelegationAwareDepositTokenImpl:
      return deployDelegationAwareDepositToken;
    default:
      throw Error(`Missing depositToken deployment script for: ${id}`);
  }
};

export const initReservesByHelper = async (
  addressProvider: MarketAccessController,
  reservesParams: { [symbol: string]: IReserveParams },
  reservesParamsOpt: boolean,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  names: ITokenNames,
  skipExistingAssets: boolean,
  verify: boolean
) => {
  // CHUNK CONFIGURATION
  const initChunks = 1;

  const reserveInfo: {
    tokenAddress: tEthereumAddress;
    symbol: string;
    decimals: number;
    depositTokenType: string;
    strategyAddress: tEthereumAddress;
    external: boolean;
  }[] = [];

  const initInputParams: {
    depositTokenImpl: string;
    stableDebtTokenImpl: string;
    variableDebtTokenImpl: string;
    underlyingAssetDecimals: number;
    strategy: string;
    underlyingAsset: string;
    depositTokenName: string;
    depositTokenSymbol: string;
    variableDebtTokenName: string;
    variableDebtTokenSymbol: string;
    stableDebtTokenName: string;
    stableDebtTokenSymbol: string;
    externalStrategy: boolean;
    params: string;
  }[] = [];

  interface StrategyInfo {
    address: tEthereumAddress;
    external: boolean;
  }

  let strategyAddressesByName: Record<string, StrategyInfo> = {};

  const existingAssets = new Set<string>();
  const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());

  if (skipExistingAssets) {
    const reserves = await lendingPool.getReservesList();
    reserves.forEach((addr) => existingAssets.add(addr.toLowerCase()));
    console.log('Existing assets:', existingAssets);
  }

  let hasDeposit = false;
  let hasDelegationAware = false;
  let hasVariableDebt = false;
  let hasStableDebt = false;

  for (let [symbol, params] of Object.entries(reservesParams)) {
    const tokenAddress = tokenAddresses[symbol];
    if (falsyOrZeroAddress(tokenAddress)) {
      console.log(`Asset ${symbol} is missing`);
      if (!reservesParamsOpt) {
        throw 'asset is missing: ' + symbol;
      }
      continue;
    }

    if (existingAssets.has(tokenAddress.toLowerCase())) {
      console.log(`Asset ${symbol} already exists`);
      continue;
    }

    const { strategy, depositTokenImpl, reserveDecimals } = params;
    if (!strategyAddressesByName[strategy.name]) {
      // Strategy does not exist, create a new one

      const factoryInfo = getStrategyFactory(strategy);

      if (factoryInfo == undefined) {
        console.log(`Asset ${symbol} has unknown strategy type: ${strategy.strategyImpl}`);
        continue;
      }

      const strategyContract = await factoryInfo.deployFn(addressProvider, verify);
      if (!factoryInfo.external) {
        hasVariableDebt = true;
        hasStableDebt = true;
      }

      strategyAddressesByName[strategy.name] = {
        address: strategyContract.address,
        external: factoryInfo.external,
      };
    }
    const strategyInfo = strategyAddressesByName[strategy.name];
    console.log('Strategy address for asset %s: %s', symbol, strategyInfo.address);

    if (depositTokenImpl === eContractid.DepositTokenImpl) {
      hasDeposit = true;
      console.log('---- generic deposit:', symbol);
    } else if (depositTokenImpl === eContractid.DelegationAwareDepositTokenImpl) {
      hasDelegationAware = true;
      console.log('---- delegation-aware:', symbol);
    } else {
      console.log('---- unknown:', symbol, depositTokenImpl);
      continue;
    }

    reserveInfo.push({
      tokenAddress: tokenAddress,
      symbol: symbol,
      decimals: reserveDecimals,
      depositTokenType: depositTokenImpl,
      strategyAddress: strategyInfo.address,
      external: strategyInfo.external,
    });
  }

  if (reserveInfo.length == 0) {
    return;
  }

  const stableDebtTokenImpl = hasStableDebt ? await deployStableDebtTokenImpl(verify, skipExistingAssets) : undefined;
  const variableDebtTokenImpl = hasVariableDebt
    ? await deployVariableDebtTokenImpl(verify, skipExistingAssets)
    : undefined;
  const depositTokenImpl = hasDeposit ? await deployDepositTokenImpl(verify, skipExistingAssets) : undefined;

  const delegationAwareTokenImpl = hasDelegationAware
    ? await deployDelegationAwareDepositTokenImpl(verify, skipExistingAssets)
    : undefined;

  const reserveSymbols: string[] = [];
  for (const info of reserveInfo) {
    let tokenToUse: string;
    if (info.depositTokenType == eContractid.DepositTokenImpl) {
      tokenToUse = depositTokenImpl!.address;
    } else {
      tokenToUse = delegationAwareTokenImpl!.address;
    }

    reserveSymbols.push(info.symbol);
    initInputParams.push({
      depositTokenImpl: tokenToUse,
      stableDebtTokenImpl: info.external ? ZERO_ADDRESS : stableDebtTokenImpl!.address,
      variableDebtTokenImpl: info.external ? ZERO_ADDRESS : variableDebtTokenImpl!.address,
      underlyingAssetDecimals: info.decimals,
      strategy: info.strategyAddress,
      underlyingAsset: info.tokenAddress,

      depositTokenName: `${names.DepositTokenNamePrefix} ${info.symbol}`,
      depositTokenSymbol: `${names.DepositSymbolPrefix}${names.SymbolPrefix}${info.symbol}`,

      variableDebtTokenName: `${names.VariableDebtTokenNamePrefix} ${info.symbol}`,
      variableDebtTokenSymbol: `${names.VariableDebtSymbolPrefix}${names.SymbolPrefix}${info.symbol}`,

      stableDebtTokenName: `${names.StableDebtTokenNamePrefix} ${info.symbol}`,
      stableDebtTokenSymbol: `${names.StableDebtSymbolPrefix}${names.SymbolPrefix}${info.symbol}`,

      externalStrategy: info.external,
      params: '0x10',
    });
  }

  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR)
  );

  if (initInputParams.length > 0) {
    // Deploy init reserves per chunks
    const chunkedSymbols = chunk(reserveSymbols, initChunks);
    const chunkedInitInputParams = chunk(initInputParams, initChunks);

    console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
      const param = chunkedInitInputParams[chunkIndex];
      console.log(param);
      const tx3 = await waitForTx(
        await configurator.batchInitReserve(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }
  }

  if (!verify) {
    return;
  }

  const treasuryAddr = await addressProvider.getAddress(AccessFlags.TREASURY);

  const registerTokenProxy = async (
    assetAddr: string,
    tokenSymbol: string,
    tokenName: string,
    decimals: number,
    params: string,
    proxyAddr: string,
    implAddr: string
  ) => {
    console.log('\t', tokenSymbol, proxyAddr, implAddr);

    const v = await getIInitializablePoolToken(proxyAddr);
    const data = v.interface.encodeFunctionData('initialize', [
      {
        pool: lendingPool.address,
        treasury: treasuryAddr,
        underlyingAsset: assetAddr,
        underlyingDecimals: decimals,
      },
      tokenName,
      tokenSymbol,
      params,
    ]);
    await addProxyToJsonDb('POOL_TOKEN_' + tokenSymbol, proxyAddr, implAddr, 'poolToken', [
      configurator.address,
      implAddr,
      data,
    ]);
  };

  console.log('Collecting verification data for pool tokens');
  for (const params of initInputParams) {
    const reserve = await lendingPool.getReserveData(params.underlyingAsset);
    await registerTokenProxy(
      params.underlyingAsset,
      params.depositTokenSymbol,
      params.depositTokenName,
      params.underlyingAssetDecimals,
      params.params,
      reserve.depositTokenAddress,
      params.depositTokenImpl
    );

    if (!falsyOrZeroAddress(reserve.variableDebtTokenAddress)) {
      await registerTokenProxy(
        params.underlyingAsset,
        params.variableDebtTokenSymbol,
        params.variableDebtTokenName,
        params.underlyingAssetDecimals,
        params.params,
        reserve.variableDebtTokenAddress,
        params.variableDebtTokenImpl
      );
    }

    if (!falsyOrZeroAddress(reserve.stableDebtTokenAddress)) {
      await registerTokenProxy(
        params.underlyingAsset,
        params.stableDebtTokenSymbol,
        params.stableDebtTokenName,
        params.underlyingAssetDecimals,
        params.params,
        reserve.stableDebtTokenAddress,
        params.stableDebtTokenImpl
      );
    }
  }
};

export const getTokenAggregatorPairs = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress }
): [string[], string[]] => {
  const { ETH, USD, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH') {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex((value) => value === tokenSymbol);
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][])[
        aggregatorAddressIndex
      ];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const configureReservesByHelper = async (
  addressProvider: MarketAccessController,
  reservesParams: { [symbol: string]: IReserveParams },
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  helpers: ProtocolDataProvider
) => {
  const symbols: string[] = [];

  const inputParams: {
    asset: string;
    baseLTV: number;
    liquidationThreshold: number;
    liquidationBonus: number;
    reserveFactor: number;
    borrowingEnabled: boolean;
    stableBorrowingEnabled: boolean;
  }[] = [];

  for (const [
    assetSymbol,
    {
      baseLTVAsCollateral,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      borrowingEnabled,
      stableBorrowRateEnabled,
    },
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
    if (baseLTVAsCollateral < 0) continue;

    const tokenAddress = tokenAddresses[assetSymbol];
    if (falsyOrZeroAddress(tokenAddress)) {
      console.log(`- Token ${assetSymbol} has an invalid address, skipping`);
      continue;
    }

    const { usageAsCollateralEnabled: alreadyEnabled } = await helpers.getReserveConfigurationData(tokenAddress);

    if (alreadyEnabled) {
      console.log(`- Reserve ${assetSymbol} is already enabled as collateral, skipping`);
      continue;
    }
    // Push data

    inputParams.push({
      asset: tokenAddress,
      baseLTV: baseLTVAsCollateral,
      liquidationThreshold: liquidationThreshold,
      liquidationBonus: liquidationBonus,
      reserveFactor: reserveFactor,
      borrowingEnabled: borrowingEnabled,
      stableBorrowingEnabled: stableBorrowRateEnabled,
    });

    symbols.push(assetSymbol);
  }
  if (!inputParams.length) {
    return;
  }

  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR)
  );

  // Deploy init per chunks
  const enableChunks = 20;
  const chunkedSymbols = chunk(symbols, enableChunks);
  const chunkedInputParams = chunk(inputParams, enableChunks);

  console.log(`- Configure reserves with ${chunkedInputParams.length} tx(s)`);
  for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await configurator.configureReserves(chunkedInputParams[chunkIndex], {
        gasLimit: 5000000,
      })
    );
    console.log(`  - Configured for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
  }
};

interface StrategyFactoryInfo {
  external: boolean;
  deployFn: (ac: MarketAccessController, verify: boolean) => Promise<Contract>;
  optionalUnderlying?: boolean;
  feedFactoryFn?: (
    name: string,
    asset: tEthereumAddress,
    underlyingSource: tEthereumAddress,
    verify: boolean
  ) => Promise<Contract | string>;
}

const getStrategyFactory = (strategy: IInterestRateStrategyParams): StrategyFactoryInfo | undefined => {
  if (strategy.strategyImpl == undefined) {
    return {
      external: false,
      deployFn: async (ac: MarketAccessController, verify: boolean) =>
        await deployReserveInterestRateStrategy(
          strategy.name,
          [
            ac.address,
            strategy.optimalUtilizationRate,
            strategy.baseVariableBorrowRate,
            strategy.variableRateSlope1,
            strategy.variableRateSlope2,
            strategy.stableRateSlope1,
            strategy.stableRateSlope2,
          ],
          verify
        ),
    };
  }

  if (strategy.strategyImpl == eContractid.DelegatedStrategyAave) {
    return {
      external: true,
      optionalUnderlying: true,

      deployFn: async (ac: MarketAccessController, verify: boolean) =>
        await deployDelegatedStrategyAave([strategy.name], verify),

      feedFactoryFn: async (
        name: string,
        asset: tEthereumAddress,
        underlyingSource: tEthereumAddress,
        verify: boolean
      ) => {
        if (!falsyOrZeroAddress(underlyingSource)) {
          return await getIChainlinkAggregator(underlyingSource);
        }
        return '';
      },
    };
  }

  if (strategy.strategyImpl == eContractid.DelegatedStrategyCompoundErc20) {
    return {
      external: true,
      optionalUnderlying: false,

      feedFactoryFn: async (
        name: string,
        asset: tEthereumAddress,
        underlyingSource: tEthereumAddress,
        verify: boolean
      ) => {
        if (falsyOrZeroAddress(underlyingSource)) {
          throw 'Unknown underlying price feed: ' + name;
        }
        return await deployPriceFeedCompoundErc20(name, [asset, underlyingSource], verify);
      },

      deployFn: async (ac: MarketAccessController, verify: boolean) =>
        await deployDelegatedStrategyCompoundErc20([strategy.name, ac.address], verify),
    };
  }

  if (strategy.strategyImpl == eContractid.DelegatedStrategyCompoundEth) {
    return {
      external: true,
      optionalUnderlying: true,

      feedFactoryFn: async (name: string, asset: tEthereumAddress, s: tEthereumAddress, verify: boolean) =>
        await deployPriceFeedCompoundEth(name, [asset], verify),

      deployFn: async (ac: MarketAccessController, verify: boolean) => {
        const wethGateway = await getWETHGateway(await ac.getAddress(AccessFlags.WETH_GATEWAY));
        const wethAddress = await wethGateway.getWETHAddress();
        if (falsyOrZeroAddress(wethAddress)) {
          throw 'wethAddress is required';
        }

        return await deployDelegatedStrategyCompoundEth([strategy.name, ac.address, wethAddress], verify);
      },
    };
  }

  return undefined;
};

export const initReservePriceFeeds = async (
  addressProvider: MarketAccessController,
  reservesParams: { [symbol: string]: IReserveParams },
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  remappings: { [symbol: string]: tEthereumAddress },
  verify: boolean
) => {
  const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
  const po = await getOracleRouter(await addressProvider.getPriceOracle());

  console.log('Checking for derived price feeds');

  const existingAssets = new Set<string>();
  const reserves = await lendingPool.getReservesList();
  reserves.forEach((addr) => existingAssets.add(addr.toLowerCase()));

  const assets: tEthereumAddress[] = [];
  const names: string[] = [];
  const factories: StrategyFactoryInfo[] = [];

  for (let [symbol, params] of Object.entries(reservesParams)) {
    const tokenAddress = tokenAddresses[symbol];
    if (falsyOrZeroAddress(tokenAddress)) {
      continue;
    }
    if (!existingAssets.has(tokenAddress.toLowerCase())) {
      continue;
    }

    const factoryInfo = getStrategyFactory(params.strategy);
    if (factoryInfo == undefined) {
      console.log(`Asset ${symbol} has unknown strategy type: ${params.strategy.strategyImpl}`);
      continue;
    }
    if (factoryInfo.feedFactoryFn == undefined) {
      continue;
    }
    names.push(symbol);
    assets.push(tokenAddress);
    factories.push(factoryInfo);
  }

  console.log('Found', assets.length, 'asset(s) for derived price feeds');
  if (assets.length == 0) {
    return;
  }

  const sources = await po.getAssetSources(assets);
  const indices: number[] = [];
  const underlyings: tEthereumAddress[] = [];
  const remaps = new Map<string, string>();

  for (const [k, v] of Object.entries(remappings)) {
    remaps.set(k.toLowerCase(), v);
  }
  console.log('Found', remaps.size, 'remapping(s)');

  for (let i = 0; i < assets.length; i++) {
    if (!falsyOrZeroAddress(sources[i])) {
      console.log('\tPrice feed found for ', names[i]);
      continue;
    }

    const rd = await lendingPool.getReserveData(assets[i]);
    const strategy = await getIReserveDelegatedStrategy(rd.strategy);
    const underlying = await strategy.getUnderlying(assets[i]);
    const remapped = remaps.get(underlying.toLowerCase());
    if (falsyOrZeroAddress(remapped)) {
      underlyings.push(underlying);
    } else {
      console.log('\tUnderlying remapped:', names[i], underlying, '=>', remapped);
      underlyings.push(remapped!);
    }

    indices.push(i);
  }

  console.log('Found', underlyings.length, 'missing derived price feed(s)');
  if (underlyings.length == 0) {
    return;
  }

  const underlyingSources = await po.getAssetSources(underlyings);

  const staticAssets: tEthereumAddress[] = [];
  const staticPrices: tEthereumAddress[] = [];

  const feedAssets: tEthereumAddress[] = [];
  const feeds: tEthereumAddress[] = [];

  for (let i = 0; i < underlyingSources.length; i++) {
    const idx = indices[i];
    const asset = assets[idx];
    const symbol = names[idx];
    const factoryInfo = factories[idx];

    if (!factoryInfo.optionalUnderlying && falsyOrZeroAddress(underlyingSources[i])) {
      console.error('\tUnknown underlying price feed:', symbol, underlyings[i]);
      continue;
    }

    console.log('\tDeploying derived price feed:', symbol, asset, underlyingSources[i]);
    const feed = await factoryInfo.feedFactoryFn!(symbol, asset, underlyingSources[i], verify);

    if (typeof feed == 'string') {
      staticAssets.push(asset);
      if (feed != '') {
        staticPrices.push(feed);
      } else {
        const staticPrice = await po.getAssetPrice(underlyings[i]);
        staticPrices.push(staticPrice.toString());
      }
    } else {
      feedAssets.push(asset);
      feeds.push(feed.address);
    }
  }

  if (feeds.length > 0) {
    console.log('Set ', feeds.length, 'derived price feed(s) as price sources');
    await mustWaitTx(po.setAssetSources(feedAssets, feeds, { gasLimit: 1000000 }));
  }

  if (staticAssets.length > 0) {
    const so = await getStaticPriceOracle(await po.getFallbackOracle());
    console.log('Set ', staticAssets.length, 'derived static price(s) as price sources');
    await mustWaitTx(so.setAssetPrices(staticAssets, staticPrices, { gasLimit: 1000000 }));
  }
};

export const getUniAgfEth = async (
  addressProvider: MarketAccessController,
  uniswapAddr: undefined | tEthereumAddress
) => {
  if (falsyOrZeroAddress(uniswapAddr)) {
    console.log('\tUniswap address is missing');
    return '';
  }

  const uniswapRouter = await getIUniswapV2Router02(uniswapAddr!);
  const weth = await uniswapRouter.WETH();
  const uniswapFactory = await getIUniswapV2Factory(await uniswapRouter.factory());
  const agfAddr = await addressProvider.getAddress(AccessFlags.REWARD_TOKEN);
  const lpPairAddr = await uniswapFactory.getPair(weth, agfAddr);

  if (falsyOrZeroAddress(lpPairAddr)) {
    console.log('\tUniswap Pair ETH-AGF not found');
  }

  return lpPairAddr;
};

export const deployUniAgfEth = async (
  ac: MarketAccessController,
  agfAddr: tEthereumAddress,
  uniswapAddr: tEthereumAddress | undefined,
  newAgfToken: boolean
) => {
  console.log('Deploy Uniswap Pair ETH-AGF');
  if (falsyOrZeroAddress(uniswapAddr)) {
    console.log('\tUniswap address is missing');
    return;
  }

  const wethGw = await getWETHGateway(await ac.getAddress(AccessFlags.WETH_GATEWAY));
  const weth = await wethGw.getWETHAddress();

  const uniswapRouter = await getIUniswapV2Router02(uniswapAddr!);
  const uniWeth = await uniswapRouter.WETH();
  if (weth.toLowerCase() != uniWeth.toLowerCase()) {
    throw 'WETH address mismatched with Uniswap: ' + weth + ', ' + uniWeth;
  }

  const uniswapFactory = await getIUniswapV2Factory(await uniswapRouter.factory());
  let lpPair = newAgfToken ? '' : await uniswapFactory.getPair(weth, agfAddr);
  if (falsyOrZeroAddress(lpPair)) {
    console.log('\tCreating uniswap pair ETH-AGF');
    await mustWaitTx(uniswapFactory.createPair(weth, agfAddr));
    lpPair = await waitForAddressFn(async () => await uniswapFactory.getPair(weth, agfAddr), 'ETH-AGF');
  }
  console.log('Uniswap pair ETH-AGF: ', lpPair);
};
