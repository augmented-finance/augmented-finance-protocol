import {
  eContractid,
  eEthereumNetwork,
  eNetwork,
  iMultiPoolsAssets,
  IReserveParams,
  tEthereumAddress,
} from './types';
import { ProtocolDataProvider } from '../types/ProtocolDataProvider';
import { chunk, DRE, getDb, waitForTx } from './misc-utils';
import {
  getATokensAndRatesHelper,
  getMarketAddressController,
  getLendingPoolConfiguratorProxy,
  getStableAndVariableTokensHelper,
} from './contracts-getters';
import { registerContractInJsonDb } from './contracts-helpers';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import {
  deployDefaultReserveInterestRateStrategy,
  deployDelegationAwareDepositToken,
  deployDelegationAwareDepositTokenImpl,
  deployDepositToken,
  deployDepositTokenImpl,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';

export const chooseDepositTokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.DepositTokenImpl:
      return deployDepositToken;
    case eContractid.DelegationAwareDepositTokenImpl:
      return deployDelegationAwareDepositToken;
    default:
      throw Error(`Missing aToken deployment script for: ${id}`);
  }
};

export const initReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  depositTokenNamePrefix: string,
  stableDebtTokenNamePrefix: string,
  variableDebtTokenNamePrefix: string,
  symbolPrefix: string,
  admin: tEthereumAddress,
  treasuryAddress: tEthereumAddress,
  verify: boolean
): Promise<BigNumber> => {
  let gasUsage = BigNumber.from('0');
  const stableAndVariableDeployer = await getStableAndVariableTokensHelper();

  const addressProvider = await getMarketAddressController();

  // CHUNK CONFIGURATION
  const initChunks = 1;

  // Initialize variables for future reserves initialization
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];
  let reserveSymbols: string[] = [];

  let initInputParams: {
    aTokenImpl: string;
    stableDebtTokenImpl: string;
    variableDebtTokenImpl: string;
    underlyingAssetDecimals: BigNumberish;
    interestRateStrategyAddress: string;
    underlyingAsset: string;
    treasury: string;
    incentivesController: string;
    underlyingAssetName: string;
    aTokenName: string;
    aTokenSymbol: string;
    variableDebtTokenName: string;
    variableDebtTokenSymbol: string;
    stableDebtTokenName: string;
    stableDebtTokenSymbol: string;
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
  let aTokenType: Record<string, string> = {};
  let delegationAwareATokenImplementationAddress = '';
  let aTokenImplementationAddress = '';
  let stableDebtTokenImplementationAddress = '';
  let variableDebtTokenImplementationAddress = '';

  // NOT WORKING ON MATIC, DEPLOYING INDIVIDUAL IMPLs INSTEAD
  const tx1 = await waitForTx(
    await stableAndVariableDeployer.initDeployment([ZERO_ADDRESS], ['1'])
  );
  console.log(tx1.events);
  tx1.events?.forEach((event, index) => {
    stableDebtTokenImplementationAddress = event?.args?.stableToken;
    variableDebtTokenImplementationAddress = event?.args?.variableToken;
  });

  const aTokenImplementation = await deployDepositTokenImpl(verify);
  aTokenImplementationAddress = aTokenImplementation.address;

  const delegatedAwareReserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) => aTokenImpl === eContractid.DelegationAwareDepositTokenImpl
  ) as [string, IReserveParams][];

  if (delegatedAwareReserves.length > 0) {
    const delegationAwareATokenImplementation = await deployDelegationAwareDepositTokenImpl(verify);
    delegationAwareATokenImplementationAddress = delegationAwareATokenImplementation.address;
  }

  const reserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) =>
      aTokenImpl === eContractid.DelegationAwareDepositTokenImpl ||
      aTokenImpl === eContractid.DepositTokenImpl
  ) as [string, IReserveParams][];

  for (let [symbol, params] of reserves) {
    // if (symbol !== 'DAI') continue;

    const { strategy, aTokenImpl, reserveDecimals } = params;
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

    if (aTokenImpl === eContractid.DepositTokenImpl) {
      aTokenType[symbol] = 'generic';
      console.log('---- generic:', symbol);
    } else if (aTokenImpl === eContractid.DelegationAwareDepositTokenImpl) {
      aTokenType[symbol] = 'delegation aware';
      console.log('---- delegation aware:', symbol);
    }

    reserveInitDecimals.push(reserveDecimals);

    if (tokenAddresses[symbol] == undefined) {
      console.log('Asset ', symbol, ' is missing in ', tokenAddresses);
      throw 'asset is missing: ' + symbol;
    }

    reserveTokens.push(tokenAddresses[symbol]);
    reserveSymbols.push(symbol);
  }

  for (let i = 0; i < reserveSymbols.length; i++) {
    let aTokenToUse: string;
    if (aTokenType[reserveSymbols[i]] === 'generic') {
      aTokenToUse = aTokenImplementationAddress;
      console.log('=-= generic:', reserveSymbols[i], aTokenToUse);
    } else {
      aTokenToUse = delegationAwareATokenImplementationAddress;
    }

    initInputParams.push({
      aTokenImpl: aTokenToUse,
      stableDebtTokenImpl: stableDebtTokenImplementationAddress,
      variableDebtTokenImpl: variableDebtTokenImplementationAddress,
      underlyingAssetDecimals: reserveInitDecimals[i],
      interestRateStrategyAddress: strategyAddressPerAsset[reserveSymbols[i]],
      underlyingAsset: reserveTokens[i],
      treasury: treasuryAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: reserveSymbols[i],
      aTokenName: `${depositTokenNamePrefix} ${reserveSymbols[i]}`,
      aTokenSymbol: `ag${symbolPrefix}${reserveSymbols[i]}`,
      variableDebtTokenName: `${variableDebtTokenNamePrefix} ${symbolPrefix}${reserveSymbols[i]}`,
      variableDebtTokenSymbol: `variableDebt${symbolPrefix}${reserveSymbols[i]}`,
      stableDebtTokenName: `${stableDebtTokenNamePrefix} ${reserveSymbols[i]}`,
      stableDebtTokenSymbol: `stableDebt${symbolPrefix}${reserveSymbols[i]}`,
      params: '0x10',
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getLendingPoolConfigurator()
  );
  //await waitForTx(await addressProvider.setPoolAdmin(admin));

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
    //gasUsage = gasUsage.add(tx3.gasUsed);
  }

  return gasUsage; // Deprecated
};

export const getPairsTokenAggregator = (
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
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  helpers: ProtocolDataProvider,
  admin: tEthereumAddress
) => {
  const addressProvider = await getMarketAddressController();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];
  const baseLTVA: string[] = [];
  const liquidationThresholds: string[] = [];
  const liquidationBonuses: string[] = [];
  const reserveFactors: string[] = [];
  const stableRatesEnabled: boolean[] = [];

  const inputParams: {
    asset: string;
    baseLTV: BigNumberish;
    liquidationThreshold: BigNumberish;
    liquidationBonus: BigNumberish;
    reserveFactor: BigNumberish;
    stableBorrowingEnabled: boolean;
  }[] = [];

  for (const [
    assetSymbol,
    {
      baseLTVAsCollateral,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
    },
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
    if (baseLTVAsCollateral === '-1') continue;
    // if (assetSymbol !== 'DAI') continue;

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
      stableBorrowingEnabled: stableBorrowRateEnabled,
    });

    tokens.push(tokenAddress);
    symbols.push(assetSymbol);
    baseLTVA.push(baseLTVAsCollateral);
    liquidationThresholds.push(liquidationThreshold);
    liquidationBonuses.push(liquidationBonus);
    reserveFactors.push(reserveFactor);
    stableRatesEnabled.push(stableBorrowRateEnabled);
  }
  if (tokens.length) {
    // Set aTokenAndRatesDeployer as temporal admin
    await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));

    // Deploy init per chunks
    const enableChunks = 1;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);

    console.log(`- Configure reserves in ${chunkedInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      await waitForTx(
        await atokenAndRatesDeployer.configureReserves(chunkedInputParams[chunkIndex], {
          gasLimit: 7000000,
        })
      );
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }
    // Set deployer back as admin
    console.log('Set deployer back as admin: ', admin);
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};
