import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getMarketAddressController, hasMarketAddressController } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';

export const getDefaultMarketAddressController = async (network: eNetwork, ctl?: tEthereumAddress) => {
  if (!falsyOrZeroAddress(ctl)) {
    return ctl!;
  }
  if (hasMarketAddressController()) {
    return (await getMarketAddressController()).address;
  }
  const POOL_NAME = ConfigNames.Augmented;
  const poolConfig = loadPoolConfig(POOL_NAME);
  const { AddressProvider } = poolConfig as ICommonConfiguration;
  return getParamPerNetwork(AddressProvider, network);
};
