import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getMarketAddressController, hasMarketAddressController } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { chunk, falsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';

export const getDefaultMarketAddressController = async (network: eNetwork, ctl?: tEthereumAddress): Promise<string> => {
  if (!falsyOrZeroAddress(ctl)) {
    return ctl!;
  }
  if (hasMarketAddressController()) {
    return (await getMarketAddressController()).address;
  }
  const POOL_NAME = ConfigNames.Augmented;
  const poolConfig = loadPoolConfig(POOL_NAME);
  const { AddressProvider } = poolConfig as ICommonConfiguration;
  return getParamPerNetwork(AddressProvider, network)!;
};

let asyncBatch = 0;

export const setPromiseBatch = (n: number) => {
  asyncBatch = n;
};

export const promiseAllBatch = async (values: Array<PromiseLike<any>>, batchCount?: number) => {
  batchCount = batchCount || asyncBatch;
  if (batchCount == 0) {
    await Promise.all(values);
    return;
  }
  if (batchCount == 1) {
    for (const p of values) {
      await p;
    }
    return;
  }
  for (const c of chunk(values, batchCount)) {
    await Promise.all(c);
  }
};
