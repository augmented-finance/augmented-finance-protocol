import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, writeUiConfig } from '../../helpers/misc-utils';
import { getAddressesProviderRegistry } from '../../helpers/contracts-getters';
import { AddressesProviderRegistry } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:write-ui-config', 'Prepares UI config')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry);
    let registry: AddressesProviderRegistry;

    if (falsyOrZeroAddress(registryAddress)) {
      registry = await getAddressesProviderRegistry();
    } else {
      registry = await getAddressesProviderRegistry(registryAddress);
    }

    const dataHelperAddress = await addressProvider.getAddress(AccessFlags.DATA_HELPER);
    if (falsyOrZeroAddress(dataHelperAddress)) {
      console.log('Data Helper is unavailable, configuration is incomplete');
      return;
    }

    writeUiConfig(DRE.network.name, registry.address, addressProvider.address, dataHelperAddress);
  });
