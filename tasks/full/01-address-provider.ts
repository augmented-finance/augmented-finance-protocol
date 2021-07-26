import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployAddressesProviderRegistry,
  deployMarketAccessController,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner, getSigner, waitForTx } from '../../helpers/misc-utils';
import { getAddressesProviderRegistry } from '../../helpers/contracts-getters';
import { AddressesProviderRegistry } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';

task('full:deploy-address-provider', 'Deploy address provider registry for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ProviderId, MarketId } = poolConfig;

    const deployer = await getFirstSigner();

    const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
    const registryOwner = getParamPerNetwork(poolConfig.ProviderRegistryOwner, network);

    let registry: AddressesProviderRegistry;

    if (!falsyOrZeroAddress(registryAddress)) {
      console.log('Existing Registry:', registryAddress);

      registry = await getAddressesProviderRegistry(registryAddress);

      const owner = await registry.owner();
      let signer;

      if (owner == deployer.address) {
        signer = deployer;
        console.log('Owned by deployer');
      } else {
        signer = getSigner(owner);
      }

      if (signer == undefined) {
        const oneTime = await registry.getOneTimeRegistrar();
        if (oneTime.user == deployer.address) {
          console.log('One-time access is granted to deployer');
        } else {
          signer = getSigner(oneTime.user);
        }
      }

      if (signer == undefined) {
        console.log('Deployer has no access');
        throw 'Deployer has no access to the registry';
      }

      registry = registry.connect(signer);
    } else {
      registry = await deployAddressesProviderRegistry(verify);
      console.log('Deployed registry:', registry.address);

      if (!falsyOrZeroAddress(registryOwner)) {
        await registry.setOneTimeRegistrar(deployer.address, ProviderId);
        await registry.transferOwnership(registryOwner!);
        console.log('Registry ownership transferred to:', registryOwner);
      }
    }

    console.log('deploy MarketAccessController');
    const addressProvider = await deployMarketAccessController(MarketId, verify);
    await addressProvider.setAnyRoleMode(false);
    console.log('Deployed provider:', addressProvider.address);

    await addressProvider.setTemporaryAdmin(deployer.address, 1000);
    if (!falsyOrZeroAddress(registryOwner)) {
      await addressProvider.transferOwnership(registryOwner!);
      console.log('Provider ownership transferred to:', registryOwner);
    }

    const poolAdmin = getParamPerNetwork(poolConfig.PoolAdmin, network);
    if (!falsyOrZeroAddress(poolAdmin)) {
      await addressProvider.grantRoles(poolAdmin!, AccessFlags.POOL_ADMIN);
    }

    const emergencyAdmin = getParamPerNetwork(poolConfig.EmergencyAdmin, network);
    if (!falsyOrZeroAddress(emergencyAdmin)) {
      await addressProvider.grantRoles(emergencyAdmin!, AccessFlags.EMERGENCY_ADMIN);
    }

    await waitForTx(await registry.registerAddressesProvider(addressProvider.address, ProviderId));
  });
