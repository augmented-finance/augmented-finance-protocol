import { IReserveParams, PoolConfiguration, ICommonConfiguration, SymbolMap, eEthereumNetwork } from './types';
import { falsyOrZeroAddress, filterMapBy } from './misc-utils';
import { getParamPerNetwork } from './contracts-helpers';
import { deployWETHMocked } from './contracts-deployments';
import { AugmentedConfig, TestConfig } from '../markets/augmented';

export enum ConfigNames {
  Test = 'Test',
  Augmented = 'Augmented',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Test:
      return TestConfig;
    case ConfigNames.Augmented:
      return AugmentedConfig;
    default:
      throw new Error(`Unsupported pool configuration: ${Object.values(ConfigNames)}`);
  }
};

// ----------------
// PROTOCOL PARAMS PER POOL
// ----------------

export const getReservesTestConfig = (): SymbolMap<IReserveParams> =>
  TestConfig.ReservesConfig[eEthereumNetwork.hardhat];

export const getWethAddress = async (config: ICommonConfiguration) => {
  const wethAddress = getParamPerNetwork(config.ReserveAssets)?.WETH;
  if (falsyOrZeroAddress(wethAddress)) {
    throw 'WETH address is required';
  }
  return wethAddress;
};

export const getOrCreateWethAddress = async (config: ICommonConfiguration) => {
  const wethAddress = getParamPerNetwork(config.ReserveAssets)?.WETH;
  if (!falsyOrZeroAddress(wethAddress)) {
    return wethAddress;
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

export const getLendingRateOracles = (poolConfig: ICommonConfiguration) => {
  const { LendingRateOracleRates } = poolConfig;
  const assets = getParamPerNetwork(poolConfig.ReserveAssets);
  return filterMapBy(LendingRateOracleRates, (key) => !falsyOrZeroAddress(assets[key]) && LendingRateOracleRates[key]);
};
