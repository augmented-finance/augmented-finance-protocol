import {
  eContractid,
  iMultiPoolsAssets,
  IReserveParams,
  ITokenNames,
  tEthereumAddress,
} from './types';
import { ProtocolDataProvider } from '../types/ProtocolDataProvider';
import { chunk, waitForTx } from './misc-utils';
import { getLendingPoolConfiguratorProxy, getLendingPoolProxy } from './contracts-getters';
import { registerContractInJsonDb } from './contracts-helpers';
import { BigNumber, BigNumberish } from 'ethers';
import {
  deployDefaultReserveInterestRateStrategy,
  deployDelegationAwareDepositToken,
  deployDelegationAwareDepositTokenImpl,
  deployDepositToken,
  deployDepositTokenImpl,
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
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  names: ITokenNames,
  skipExistingAssets: boolean,
  treasuryAddress: tEthereumAddress,
  verify: boolean
) => {
  // CHUNK CONFIGURATION
  const initChunks = 1;

  // Initialize variables for future reserves initialization
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];
  let reserveSymbols: string[] = [];

  let initInputParams: {
    depositTokenImpl: string;
    stableDebtTokenImpl: string;
    variableDebtTokenImpl: string;
    underlyingAssetDecimals: BigNumberish;
    strategy: string;
    underlyingAsset: string;
    treasury: string;
    incentivesController: string;
    underlyingAssetName: string;
    depositTokenName: string;
    depositTokenSymbol: string;
    variableDebtTokenName: string;
    variableDebtTokenSymbol: string;
    stableDebtTokenName: string;
    stableDebtTokenSymbol: string;
    reserveFlags: BigNumberish;
    params: string;
  }[] = [];

  let strategyRates: [
    string, // addresses provider
    string,
    string,
    string,
    string,
    string,
    string
  ];
  let rateStrategies: Record<string, typeof strategyRates> = {};
  let strategyAddresses: Record<string, tEthereumAddress> = {};
  let strategyAddressPerAsset: Record<string, string> = {};
  let depositTokenType: Record<string, boolean> = {};

  const stableDebtTokenImpl = await deployStableDebtTokenImpl(verify, skipExistingAssets);
  const variableDebtTokenImpl = await deployVariableDebtTokenImpl(verify, skipExistingAssets);
  const depositTokenImpl = await deployDepositTokenImpl(verify, skipExistingAssets);

  const delegatedAwareReserves = Object.entries(reservesParams).filter(
    ([_, { depositTokenImpl }]) => depositTokenImpl === eContractid.DelegationAwareDepositTokenImpl
  ) as [string, IReserveParams][];

  const delegationAwareTokenImpl =
    delegatedAwareReserves.length > 0
      ? await deployDelegationAwareDepositTokenImpl(verify, skipExistingAssets)
      : undefined;

  const existingAssets = new Set<string>();

  if (skipExistingAssets) {
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
    const reserves = await lendingPool.getReservesList();
    reserves.forEach((addr) => existingAssets.add(addr));
  }

  const reserves = Object.entries(reservesParams).filter(
    ([_, { depositTokenImpl }]) =>
      depositTokenImpl === eContractid.DelegationAwareDepositTokenImpl ||
      depositTokenImpl === eContractid.DepositTokenImpl
  ) as [string, IReserveParams][];

  for (let [symbol, params] of reserves) {
    const tokenAddress = tokenAddresses[symbol];
    if (tokenAddress == undefined) {
      console.log(`Asset ${symbol} is missing in ${tokenAddresses}`);
      throw 'asset is missing: ' + symbol;
    }

    if (existingAssets.has(tokenAddress)) {
      console.log(`Asset ${symbol} already exists`);
      continue;
    }

    const { strategy, depositTokenImpl, reserveDecimals } = params;
    const {
      optimalUtilizationRate,
      baseVariableBorrowRate,
      variableRateSlope1,
      variableRateSlope2,
      stableRateSlope1,
      stableRateSlope2,
    } = strategy;
    if (!strategyAddresses[strategy.name]) {
      // Strategy does not exist, create a new one
      rateStrategies[strategy.name] = [
        addressProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ];
      const strategyContract = await deployDefaultReserveInterestRateStrategy(
        rateStrategies[strategy.name],
        verify
      );
      strategyAddresses[strategy.name] = strategyContract.address;
      registerContractInJsonDb(strategy.name, strategyContract);
    }
    strategyAddressPerAsset[symbol] = strategyAddresses[strategy.name];
    console.log('Strategy address for asset %s: %s', symbol, strategyAddressPerAsset[symbol]);

    if (depositTokenImpl === eContractid.DepositTokenImpl) {
      depositTokenType[symbol] = false;
      console.log('---- generic:', symbol);
    } else if (depositTokenImpl === eContractid.DelegationAwareDepositTokenImpl) {
      depositTokenType[symbol] = true;
      console.log('---- delegation aware:', symbol);
    }

    reserveInitDecimals.push(reserveDecimals);

    reserveTokens.push(tokenAddress);
    reserveSymbols.push(symbol);
  }

  for (let i = 0; i < reserveSymbols.length; i++) {
    let tokenToUse: string;
    if (!depositTokenType[reserveSymbols[i]]) {
      tokenToUse = depositTokenImpl.address;
      console.log('=-= generic:', reserveSymbols[i], tokenToUse);
    } else {
      tokenToUse = delegationAwareTokenImpl!.address;
    }

    const reserveSymbol = reserveSymbols[i];

    initInputParams.push({
      depositTokenImpl: tokenToUse,
      stableDebtTokenImpl: stableDebtTokenImpl.address,
      variableDebtTokenImpl: variableDebtTokenImpl.address,
      underlyingAssetDecimals: reserveInitDecimals[i],
      strategy: strategyAddressPerAsset[reserveSymbol],
      underlyingAsset: reserveTokens[i],
      treasury: treasuryAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: reserveSymbol,

      depositTokenName: `${names.DepositTokenNamePrefix} ${reserveSymbol}`,
      depositTokenSymbol: `${names.DepositSymbolPrefix}${names.SymbolPrefix}${reserveSymbol}`,

      variableDebtTokenName: `${names.VariableDebtTokenNamePrefix} ${reserveSymbol}`,
      variableDebtTokenSymbol: `${names.VariableDebtSymbolPrefix}${names.SymbolPrefix}${reserveSymbol}`,

      stableDebtTokenName: `${names.StableDebtTokenNamePrefix} ${reserveSymbol}`,
      stableDebtTokenSymbol: `${names.StableDebtSymbolPrefix}${names.SymbolPrefix}${reserveSymbol}`,

      reserveFlags: BigNumber.from(0),
      params: '0x10',
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getLendingPoolConfigurator()
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
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
        string,
        tEthereumAddress
      ][])[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const configureReservesByHelper = async (
  addressProvider: MarketAccessController,
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  helpers: ProtocolDataProvider
) => {
  const symbols: string[] = [];

  const inputParams: {
    asset: string;
    baseLTV: BigNumberish;
    liquidationThreshold: BigNumberish;
    liquidationBonus: BigNumberish;
    reserveFactor: BigNumberish;
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
    if (baseLTVAsCollateral === '-1') continue;

    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];
    const { usageAsCollateralEnabled: alreadyEnabled } = await helpers.getReserveConfigurationData(
      tokenAddress
    );

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
    await addressProvider.getLendingPoolConfigurator()
  );

  // Deploy init per chunks
  const enableChunks = 1;
  const chunkedSymbols = chunk(symbols, enableChunks);
  const chunkedInputParams = chunk(inputParams, enableChunks);

  console.log(`- Configure reserves with ${chunkedInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
    await waitForTx(
      await configurator.configureReserves(chunkedInputParams[chunkIndex], {
        gasLimit: 5000000,
      })
    );
    console.log(`  - Configured for: ${chunkedSymbols[chunkIndex].join(', ')}`);
  }
};
