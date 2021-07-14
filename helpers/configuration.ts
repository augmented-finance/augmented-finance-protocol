import {
  LendingPools,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
  ICommonConfiguration,
  eNetwork,
} from './types';
import { getParamPerPool } from './contracts-helpers';
import { CommonsConfig } from '../markets/augmented/commons';
import { DRE, filterMapBy } from './misc-utils';
import { tEthereumAddress } from './types';
import { getParamPerNetwork } from './contracts-helpers';
import { deployWETHMocked } from './contracts-deployments';
import AugmentedConfig from '../markets/augmented';

export enum ConfigNames {
  Commons = 'Commons',
  Augmented = 'Augmented',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Commons:
      return CommonsConfig;
    case ConfigNames.Augmented:
      return AugmentedConfig;
    default:
      throw new Error(`Unsupported pool configuration: ${Object.values(ConfigNames)}`);
  }
};

// ----------------
// PROTOCOL PARAMS PER POOL
// ----------------

export const getReservesConfigByPool = (pool: LendingPools): iMultiPoolsAssets<IReserveParams> =>
  getParamPerPool<iMultiPoolsAssets<IReserveParams>>(
    {
      // [LendingPools.proto]: {
      //   ...AaveConfig.ReservesConfig,
      // },
      // [LendingPools.matic]: {
      //   ...MaticConfig.ReservesConfig,
      // },
      [LendingPools.augmented]: {
        ...AugmentedConfig.ReservesConfig,
      },
    },
    pool
  );

export const getGenesisPoolAdmin = async (
  config: ICommonConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.PoolAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await Promise.all(
    (await DRE.ethers.getSigners()).map((signer) => signer.getAddress())
  );
  const addressIndex = config.PoolAdminIndex;
  return addressList[addressIndex];
};

export const getEmergencyAdmin = async (
  config: ICommonConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.EmergencyAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await Promise.all(
    (await DRE.ethers.getSigners()).map((signer) => signer.getAddress())
  );
  const addressIndex = config.EmergencyAdminIndex;
  return addressList[addressIndex];
};

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
  const {
    ProtocolGlobalParams: { UsdAddress },
    LendingRateOracleRatesCommon,
    ReserveAssets,
  } = poolConfig;

  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  const network = MAINNET_FORK ? 'main' : DRE.network.name;
  return filterMapBy(LendingRateOracleRatesCommon, (key) =>
    Object.keys(ReserveAssets[network]).includes(key)
  );
};
