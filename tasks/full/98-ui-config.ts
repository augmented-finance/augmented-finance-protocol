import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eNetwork } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, writeUiConfig } from '../../helpers/misc-utils';
import {
  getAddressesProviderRegistry,
  getMarketAddressController,
  getProtocolDataProvider,
} from '../../helpers/contracts-getters';
import { AddressesProviderRegistry, MarketAccessController } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:write-ui-config', 'Prepare UI config')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ProviderId, MarketId } = poolConfig;

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
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

    writeUiConfig(network, registry.address, addressProvider.address, dataHelperAddress);
  });
