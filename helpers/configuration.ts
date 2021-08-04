import {
  IReserveParams,
  PoolConfiguration,
  ICommonConfiguration,
  eNetwork,
  iAssetCommon,
} from './types';
import { DRE, filterMapBy } from './misc-utils';
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
  const wethAddress = getParamPerNetwork(config.WETH, <eNetwork>currentNetwork);
  if (wethAddress) {
    return wethAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WETH not set at mainnet configuration.');
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
