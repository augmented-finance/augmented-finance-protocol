import { tEthereumAddress, IMarketRates, iAssetBase, iAssetAggregatorBase, SymbolMap } from './types';

import { LendingRateOracle } from '../types/LendingRateOracle';
import { MockAggregator } from '../types/MockAggregator';
import { deployMockAggregator } from './contracts-deployments';
import { chunk, waitForTx } from './misc-utils';
import { MockPriceOracle } from '../types';

export const setInitialMarketRatesInRatesOracleByHelper = async (
  marketRates: { [key: string]: IMarketRates },
  assetsAddresses: { [x: string]: tEthereumAddress },
  lendingRateOracleInstance: LendingRateOracle
) => {
  const assetAddresses: string[] = [];
  const borrowRates: string[] = [];
  const symbols: string[] = [];
  for (const [assetSymbol, rates] of Object.entries(marketRates) as [string, IMarketRates][]) {
    if (!rates) {
      continue;
    }
    const borrowRate = rates!.borrowRate;

    const assetAddressIndex = Object.keys(assetsAddresses).findIndex((value) => value === assetSymbol);
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[assetAddressIndex];
    assetAddresses.push(assetAddress);
    borrowRates.push(borrowRate);
    symbols.push(assetSymbol);
  }
  // Set borrow rates per chunks
  const ratesChunks = 20;
  const chunkedTokens = chunk(assetAddresses, ratesChunks);
  const chunkedRates = chunk(borrowRates, ratesChunks);
  const chunkedSymbols = chunk(symbols, ratesChunks);

  console.log(`- Oracle borrow initalization in ${chunkedTokens.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedTokens.length; chunkIndex++) {
    await waitForTx(
      await lendingRateOracleInstance.setMarketBorrowRates(chunkedTokens[chunkIndex], chunkedRates[chunkIndex], {
        gasLimit: 5000000,
      })
    );
    console.log(`  - Setted Oracle Borrow Rates for: ${chunkedSymbols[chunkIndex].join(', ')}`);
  }
};

export const setInitialAssetPricesInOracle = async (
  prices: iAssetBase<tEthereumAddress>,
  assetsAddresses: { [key: string]: tEthereumAddress },
  priceOracleInstance: MockPriceOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    console.log('Trying for ', assetsAddresses, assetSymbol);

    const assetAddressIndex = Object.keys(assetsAddresses).findIndex((value) => value === assetSymbol);
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[assetAddressIndex];
    await waitForTx(await priceOracleInstance.setAssetPrice(assetAddress, price));
  }
};

export const setAssetPricesInOracle = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  priceOracleInstance: MockPriceOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex((value) => value === assetSymbol);
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[assetAddressIndex];
    await waitForTx(await priceOracleInstance.setAssetPrice(assetAddress, price));
  }
};

export const deployMockAggregators = async (initialPrices: SymbolMap<string>, verify?: boolean) => {
  const aggregators: { [tokenSymbol: string]: MockAggregator } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== 'ETH') {
      const priceIndex = Object.keys(initialPrices).findIndex((value) => value === tokenContractName);
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];
      aggregators[tokenContractName] = await deployMockAggregator(price, verify);
    }
  }
  return aggregators;
};

export const deployAllMockAggregators = async (initialPrices: iAssetAggregatorBase<string>, verify?: boolean) => {
  const aggregators: { [tokenSymbol: string]: MockAggregator } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== 'ETH') {
      const priceIndex = Object.keys(initialPrices).findIndex((value) => value === tokenContractName);
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];
      aggregators[tokenContractName] = await deployMockAggregator(price, verify);
    }
  }
  return aggregators;
};
