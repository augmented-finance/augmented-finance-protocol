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
  getProtocolDataProvider,
  getAToken,
  getATokensAndRatesHelper,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getStableAndVariableTokensHelper,
} from './contracts-getters';
import { rawInsertContractAddressInDb } from './contracts-helpers';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import {
  deployDefaultReserveInterestRateStrategy,
  deployDelegationAwareAToken,
  deployDelegationAwareATokenImpl,
  deployGenericAToken,
  deployGenericATokenImpl,
  deployGenericStableDebtToken,
  deployGenericVariableDebtToken,
  deployStableDebtToken,
  deployVariableDebtToken,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';
import { isZeroAddress } from 'ethereumjs-util';
import { DefaultReserveInterestRateStrategy, DelegationAwareAToken } from '../types';

export const chooseATokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.DepositToken:
      return deployGenericAToken;
    case eContractid.DelegationAwareAToken:
      return deployDelegationAwareAToken;
    default:
      throw Error(`Missing aToken deployment script for: ${id}`);
  }
};

export const initReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  aTokenNamePrefix: string,
  stableDebtTokenNamePrefix: string,
  variableDebtTokenNamePrefix: string,
  symbolPrefix: string,
  admin: tEthereumAddress,
  treasuryAddress: tEthereumAddress,
  incentivesController: tEthereumAddress,
  verify: boolean
): Promise<BigNumber> => {
  let gasUsage = BigNumber.from('0');
  const stableAndVariableDeployer = await getStableAndVariableTokensHelper();

  const addressProvider = await getLendingPoolAddressesProvider();

  // CHUNK CONFIGURATION
  const initChunks = 4;

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
  // const tx1 = await waitForTx(
  //   await stableAndVariableDeployer.initDeployment([ZERO_ADDRESS], ["1"])
  // );
  // console.log(tx1.events);
  // tx1.events?.forEach((event, index) => {
  //   stableDebtTokenImplementationAddress = event?.args?.stableToken;
  //   variableDebtTokenImplementationAddress = event?.args?.variableToken;
  //   rawInsertContractAddressInDb(`stableDebtTokenImpl`, stableDebtTokenImplementationAddress);
  //   rawInsertContractAddressInDb(`variableDebtTokenImpl`, variableDebtTokenImplementationAddress);
  // });
  //gasUsage = gasUsage.add(tx1.gasUsed);
  stableDebtTokenImplementationAddress = await (await deployGenericStableDebtToken()).address;
  variableDebtTokenImplementationAddress = await (await deployGenericVariableDebtToken()).address;

  const aTokenImplementation = await deployGenericATokenImpl(verify);
  aTokenImplementationAddress = aTokenImplementation.address;
  rawInsertContractAddressInDb(`aTokenImpl`, aTokenImplementationAddress);

  const delegatedAwareReserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) => aTokenImpl === eContractid.DelegationAwareAToken
  ) as [string, IReserveParams][];

  if (delegatedAwareReserves.length > 0) {
    const delegationAwareATokenImplementation = await deployDelegationAwareATokenImpl(verify);
    delegationAwareATokenImplementationAddress = delegationAwareATokenImplementation.address;
    rawInsertContractAddressInDb(
      `delegationAwareATokenImpl`,
      delegationAwareATokenImplementationAddress
    );
  }

  const reserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) =>
      aTokenImpl === eContractid.DelegationAwareAToken || aTokenImpl === eContractid.DepositToken
  ) as [string, IReserveParams][];

  for (let [symbol, params] of reserves) {
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
      strategyAddresses[strategy.name] = (
        await deployDefaultReserveInterestRateStrategy(rateStrategies[strategy.name], verify)
      ).address;
      // This causes the last strategy to be printed twice, once under "DefaultReserveInterestRateStrategy"
      // and once under the actual `strategyASSET` key.
      rawInsertContractAddressInDb(strategy.name, strategyAddresses[strategy.name]);
    }
    strategyAddressPerAsset[symbol] = strategyAddresses[strategy.name];
    console.log('Strategy address for asset %s: %s', symbol, strategyAddressPerAsset[symbol]);

    if (aTokenImpl === eContractid.DepositToken) {
      aTokenType[symbol] = 'generic';
    } else if (aTokenImpl === eContractid.DelegationAwareAToken) {
      aTokenType[symbol] = 'delegation aware';
    }

    reserveInitDecimals.push(reserveDecimals);
    reserveTokens.push(tokenAddresses[symbol]);
    reserveSymbols.push(symbol);
  }

  for (let i = 0; i < reserveSymbols.length; i++) {
    let aTokenToUse: string;
    if (aTokenType[reserveSymbols[i]] === 'generic') {
      aTokenToUse = aTokenImplementationAddress;
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
      aTokenName: `${aTokenNamePrefix} ${reserveSymbols[i]}`,
      aTokenSymbol: `a${symbolPrefix}${reserveSymbols[i]}`,
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

  const configurator = await getLendingPoolConfiguratorProxy();
  //await waitForTx(await addressProvider.setPoolAdmin(admin));

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex])
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
  const addressProvider = await getLendingPoolAddressesProvider();
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
    const enableChunks = 20;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);

    console.log(`- Configure reserves in ${chunkedInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      await waitForTx(
        await atokenAndRatesDeployer.configureReserves(chunkedInputParams[chunkIndex], {
          gasLimit: 12000000,
        })
      );
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};

const getAddressById = async (
  id: string,
  network: eNetwork
): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${network}`).value())?.address || undefined;

// Function deprecated? Updated but untested, script is not updated on package.json.
// This is not called during regular deployment, only in the "full:initialize-tokens"
// hardhat task.
export const initTokenReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress,
  addressesProviderAddress: tEthereumAddress,
  ratesHelperAddress: tEthereumAddress,
  dataProviderAddress: tEthereumAddress,
  signer: Signer,
  treasuryAddress: tEthereumAddress,
  verify: boolean
) => {
  let gasUsage = BigNumber.from('0');
  const atokenAndRatesDeployer = await (await getATokensAndRatesHelper(ratesHelperAddress)).connect(
    signer
  );

  const addressProvider = await (
    await getLendingPoolAddressesProvider(addressesProviderAddress)
  ).connect(signer);
  const protocolDataProvider = await (await getProtocolDataProvider(dataProviderAddress)).connect(
    signer
  );
  const poolAddress = await addressProvider.getLendingPool();

  // Set aTokenAndRatesDeployer as temporal admin
  //await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));

  // CHUNK CONFIGURATION
  const initChunks = 4;

  // Initialize variables for future reserves initialization
  let deployedStableTokens: string[] = [];
  let deployedVariableTokens: string[] = [];
  let deployedATokens: string[] = [];
  let deployedRates: string[] = [];
  //let reserveTokens: string[] = [];
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

  const network =
    process.env.MAINNET_FORK === 'true' ? eEthereumNetwork.main : (DRE.network.name as eNetwork);
  // Grab config from DB
  for (const [symbol, address] of Object.entries(tokenAddresses)) {
    const { aTokenAddress } = await protocolDataProvider.getReserveTokensAddresses(address);
    const reserveParamIndex = Object.keys(reservesParams).findIndex((value) => value === symbol);
    const [, { reserveDecimals: decimals }] = (Object.entries(reservesParams) as [
      string,
      IReserveParams
    ][])[reserveParamIndex];

    if (!isZeroAddress(aTokenAddress)) {
      console.log(`- Skipping ${symbol} due already initialized`);
      continue;
    }
    let stableTokenImpl = await getAddressById(`stableDebtTokenImpl`, network);
    let variableTokenImpl = await getAddressById(`variableDebtTokenImpl`, network);
    let aTokenImplementation: string | undefined = '';
    const [, { aTokenImpl, strategy }] = (Object.entries(reservesParams) as [
      string,
      IReserveParams
    ][])[reserveParamIndex];
    if (aTokenImpl === eContractid.DepositToken) {
      aTokenImplementation = await getAddressById(`aTokenImpl`, network);
    } else if (aTokenImpl === eContractid.DelegationAwareAToken) {
      aTokenImplementation = await getAddressById(`delegationAwareATokenImpl`, network);
    }

    let strategyImpl = await getAddressById(strategy.name, network);

    if (!stableTokenImpl) {
      const stableDebt = await deployStableDebtToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          ZERO_ADDRESS, // Incentives controller
          `Aave stable debt bearing ${symbol}`,
          `stableDebt${symbol}`,
        ],
        verify
      );
      stableTokenImpl = stableDebt.address;
    }
    if (!variableTokenImpl) {
      const variableDebt = await deployVariableDebtToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          ZERO_ADDRESS, // Incentives Controller
          `Aave variable debt bearing ${symbol}`,
          `variableDebt${symbol}`,
        ],
        verify
      );
      variableTokenImpl = variableDebt.address;
    }
    if (!aTokenImplementation) {
      const [, { aTokenImpl }] = (Object.entries(reservesParams) as [string, IReserveParams][])[
        reserveParamIndex
      ];
      const deployCustomAToken = chooseATokenDeployment(aTokenImpl);
      const aToken = await deployCustomAToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          treasuryAddress,
          ZERO_ADDRESS,
          `Aave interest bearing ${symbol}`,
          `a${symbol}`,
        ],
        verify
      );
      aTokenImplementation = aToken.address;
    }
    if (!strategyImpl) {
      const [, { strategy }] = (Object.entries(reservesParams) as [string, IReserveParams][])[
        reserveParamIndex
      ];
      const {
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      } = strategy;
      const rates = await deployDefaultReserveInterestRateStrategy(
        [
          tokenAddresses[symbol],
          optimalUtilizationRate,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        ],
        verify
      );
      strategyImpl = rates.address;
    }
    // --- REMOVED BECAUSE WE NOW USE THE SAME IMPLEMENTATIONS ---
    // const symbols = [`a${symbol}`, `variableDebt${symbol}`, `stableDebt${symbol}`];
    // const tokens = [aTokenImplementation, variableTokenImpl, stableTokenImpl];
    // for (let index = 0; index < symbols.length; index++) {
    //   if (!(await isErc20SymbolCorrect(tokens[index], symbols[index]))) {
    //     console.error(`${symbol} and implementation does not match: ${tokens[index]}`);
    //     throw Error('Symbol does not match implementation.');
    //   }
    // }
    console.log(`- Added ${symbol} to the initialize batch`);
    deployedStableTokens.push(stableTokenImpl);
    deployedVariableTokens.push(variableTokenImpl);
    deployedATokens.push(aTokenImplementation);
    //reserveTokens.push();
    deployedRates.push(strategyImpl);
    reserveInitDecimals.push(decimals.toString());
    reserveSymbols.push(symbol);
  }

  for (let i = 0; i < deployedATokens.length; i++) {
    initInputParams.push({
      aTokenImpl: deployedATokens[i],
      stableDebtTokenImpl: deployedStableTokens[i],
      variableDebtTokenImpl: deployedVariableTokens[i],
      underlyingAssetDecimals: reserveInitDecimals[i],
      interestRateStrategyAddress: deployedRates[i],
      underlyingAsset: tokenAddresses[reserveSymbols[i]],
      treasury: treasuryAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: reserveSymbols[i],
      aTokenName: `Aave interest bearing ${reserveSymbols[i]}`,
      aTokenSymbol: `a${reserveSymbols[i]}`,
      variableDebtTokenName: `Aave variable debt bearing ${reserveSymbols[i]}`,
      variableDebtTokenSymbol: `variableDebt${reserveSymbols[i]}`,
      stableDebtTokenName: `Aave stable debt bearing ${reserveSymbols[i]}`,
      stableDebtTokenSymbol: `stableDebt${reserveSymbols[i]}`,
      params: '0x10',
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy();
  //await waitForTx(await addressProvider.setPoolAdmin(admin));

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex])
    );

    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
  }

  // Set deployer back as admin
  //await waitForTx(await addressProvider.setPoolAdmin(admin));
  return gasUsage; // No longer relevant
};

// Function deprecated
const isErc20SymbolCorrect = async (token: tEthereumAddress, symbol: string) => {
  const erc20 = await getAToken(token); // using aToken for ERC20 interface
  const erc20Symbol = await erc20.symbol();
  return symbol === erc20Symbol;
};
