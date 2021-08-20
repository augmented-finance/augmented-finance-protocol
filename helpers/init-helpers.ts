import { eContractid, IReserveParams, ITokenNames, tEthereumAddress } from './types';
import { ProtocolDataProvider } from '../types/ProtocolDataProvider';
import { chunk, falsyOrZeroAddress, waitForTx } from './misc-utils';
import { getLendingPoolConfiguratorProxy, getLendingPoolProxy, getWETHGateway } from './contracts-getters';
import { AccessFlags } from './access-flags';
import {
  deployDelegatedStrategyAave,
  deployDelegatedStrategyCompoundErc20,
  deployDelegatedStrategyCompoundEth,
  deployDelegationAwareDepositToken,
  deployDelegationAwareDepositTokenImpl,
  deployDepositToken,
  deployDepositTokenImpl,
  deployReserveInterestRateStrategy,
  deployStableDebtTokenImpl,
  deployVariableDebtTokenImpl,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';
import { MarketAccessController } from '../types';

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

  let reserveInfo: {
    tokenAddress: tEthereumAddress;
    symbol: string;
    decimals: number;
    depositTokenType: string;
    strategyAddress: tEthereumAddress;
    external: boolean;
  }[] = [];

  let initInputParams: {
    depositTokenImpl: string;
    stableDebtTokenImpl: string;
    variableDebtTokenImpl: string;
    underlyingAssetDecimals: number;
    strategy: string;
    underlyingAsset: string;
    incentivesController: string;
    underlyingAssetName: string;
    depositTokenName: string;
    depositTokenSymbol: string;
    variableDebtTokenName: string;
    variableDebtTokenSymbol: string;
    stableDebtTokenName: string;
    stableDebtTokenSymbol: string;
    externalStrategy: boolean;
    params: string;
  }[] = [];

  let strategyAddressesByName: Record<
    string,
    {
      address: tEthereumAddress;
      external: boolean;
    }
  > = {};

  const existingAssets = new Set<string>();

  if (skipExistingAssets) {
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
    const reserves = await lendingPool.getReservesList();
    reserves.forEach((addr) => existingAssets.add(addr.toUpperCase()));
    console.log('Existing assets:', existingAssets);
  }

  let hasDelegationAware = false;
  for (let [symbol, params] of Object.entries(reservesParams)) {
    const tokenAddress = tokenAddresses[symbol];
    if (falsyOrZeroAddress(tokenAddress)) {
      console.log(`Asset ${symbol} is missing`);
      if (!reservesParamsOpt) {
        throw 'asset is missing: ' + symbol;
      }
      continue;
    }

    if (existingAssets.has(tokenAddress.toUpperCase())) {
      console.log(`Asset ${symbol} already exists`);
      continue;
    }

    const { strategy, depositTokenImpl, reserveDecimals } = params;
    if (!strategyAddressesByName[strategy.name]) {
      let info = {
        address: '',
        external: false,
      };

      // Strategy does not exist, create a new one
      if (strategy.strategyImpl == undefined) {
        const strategyContract = await deployReserveInterestRateStrategy(
          strategy.name,
          [
            addressProvider.address,
            strategy.optimalUtilizationRate,
            strategy.baseVariableBorrowRate,
            strategy.variableRateSlope1,
            strategy.variableRateSlope2,
            strategy.stableRateSlope1,
            strategy.stableRateSlope2,
          ],
          verify
        );
        info.address = strategyContract.address;
      } else if (strategy.strategyImpl == eContractid.DelegatedStrategyAave) {
        const strategyContract = await deployDelegatedStrategyAave([strategy.name], verify);
        info.address = strategyContract.address;
        info.external = true;
      } else if (strategy.strategyImpl == eContractid.DelegatedStrategyCompoundErc20) {
        const strategyContract = await deployDelegatedStrategyCompoundErc20([strategy.name], verify);
        info.address = strategyContract.address;
        info.external = true;
      } else if (strategy.strategyImpl == eContractid.DelegatedStrategyCompoundEth) {
        const wethGateway = await getWETHGateway(await addressProvider.getAddress(AccessFlags.WETH_GATEWAY));
        const wethAddress = await wethGateway.getWETHAddress();
        if (falsyOrZeroAddress(wethAddress)) {
          throw 'wethAddress is required';
        }

        const strategyContract = await deployDelegatedStrategyCompoundEth([strategy.name, wethAddress], verify);
        info.address = strategyContract.address;
        info.external = true;
      } else {
        console.log(`Asset ${symbol} has unknown strategy type: ${strategy.strategyImpl}`);
        continue;
      }
      strategyAddressesByName[strategy.name] = info;
    }
    const strategyInfo = strategyAddressesByName[strategy.name];
    console.log('Strategy address for asset %s: %s', symbol, strategyInfo.address);

    if (depositTokenImpl === eContractid.DepositTokenImpl) {
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

  const stableDebtTokenImpl = await deployStableDebtTokenImpl(verify, skipExistingAssets);
  const variableDebtTokenImpl = await deployVariableDebtTokenImpl(verify, skipExistingAssets);
  const depositTokenImpl = await deployDepositTokenImpl(verify, skipExistingAssets);

  const delegationAwareTokenImpl = hasDelegationAware
    ? await deployDelegationAwareDepositTokenImpl(verify, skipExistingAssets)
    : undefined;

  const reserveSymbols: string[] = [];
  for (const info of reserveInfo) {
    let tokenToUse: string;
    if (info.depositTokenType == eContractid.DepositTokenImpl) {
      tokenToUse = depositTokenImpl.address;
    } else {
      tokenToUse = delegationAwareTokenImpl!.address;
    }

    reserveSymbols.push(info.symbol);
    initInputParams.push({
      depositTokenImpl: tokenToUse,
      stableDebtTokenImpl: stableDebtTokenImpl.address,
      variableDebtTokenImpl: variableDebtTokenImpl.address,
      underlyingAssetDecimals: info.decimals,
      strategy: info.strategyAddress,
      underlyingAsset: info.tokenAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: info.symbol,

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

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR)
  );

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const param = chunkedInitInputParams[chunkIndex];
    console.log(param);
    const tx3 = await waitForTx(
      await configurator.batchInitReserve(param, {
        gasLimit: 5000000, // TODO: remove ?
      })
    );

    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
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

  console.log(`- Configure reserves with ${chunkedInputParams.length} txs`);
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
