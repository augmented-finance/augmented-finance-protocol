import {
  IReserveParams,
  PoolConfiguration,
  ICommonConfiguration,
  eNetwork,
  iAssetCommon,
} from './types';
import { DRE, falsyOrZeroAddress, filterMapBy } from './misc-utils';
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

export const getReservesTestConfig = (): iAssetCommon<IReserveParams> => TestConfig.ReservesConfig;

export const getWethAddress = async (config: ICommonConfiguration) => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.ReserveAssets, <eNetwork>currentNetwork).WETH;
  if (falsyOrZeroAddress(wethAddress)) {
    throw 'WETH address is required';
  }
  return wethAddress;
};

export const getOrCreateWethAddress = async (config: ICommonConfiguration) => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.ReserveAssets, <eNetwork>currentNetwork).WETH;
  if (!falsyOrZeroAddress(wethAddress)) {
    return wethAddress;
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

export const getLendingRateOracles = (poolConfig: ICommonConfiguration) => {
  const { LendingRateOracleRates, ReserveAssets } = poolConfig;

  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  const network = MAINNET_FORK ? 'main' : DRE.network.name;
  return filterMapBy(LendingRateOracleRates, (key) =>
    Object.keys(ReserveAssets[network]).includes(key)
  );
};
