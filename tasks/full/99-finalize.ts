import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eNetwork } from '../../helpers/types';
import { loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  getAddressesProviderRegistry,
  getMarketAccessController,
} from '../../helpers/contracts-getters';
import { AddressesProviderRegistry } from '../../types';

task('full:deploy-finalize', 'Finalize deployment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ProviderId, MarketId } = poolConfig;

    const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
    let registry: AddressesProviderRegistry;

    if (falsyOrZeroAddress(registryAddress)) {
      registry = await getAddressesProviderRegistry();
    } else {
      registry = await getAddressesProviderRegistry(registryAddress);
    }
    await registry.renounceOneTimeRegistrar();
    console.log('Registrar permissions renounced');

    const addressProvider = await getMarketAccessController();
    addressProvider.renounceTemporaryAdmin();
    console.log('Temporary admin permissions renounced');
  });
