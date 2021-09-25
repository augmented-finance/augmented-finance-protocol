import { getParamPerNetwork, registerAndVerify } from '../../helpers/contracts-helpers';
import {
  deployAddressesProviderRegistry,
  deployMarketAccessControllerNoSave,
} from '../../helpers/contracts-deployments';
import { eContractid, eNetwork } from '../../helpers/types';
import { loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner, getSigner, mustWaitTx, waitForTx, waitTx } from '../../helpers/misc-utils';
import { getAddressesProviderRegistry } from '../../helpers/contracts-getters';
import { AddressesProviderRegistry, MarketAccessController } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';
import { setPreDeployAccessController } from '../../helpers/deploy-helpers';
import { BigNumber } from 'ethers';
import { deployTask } from '../helpers/deploy-steps';

deployTask('full:deploy-address-provider', 'Deploy address provider and registry', __dirname).setAction(
  async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { MarketId } = poolConfig;
    let ProviderId = BigNumber.from(poolConfig.ProviderId);

    const deployer = await getFirstSigner();

    const [continuation, existingProvider] = await setPreDeployAccessController(
      getParamPerNetwork(poolConfig.AddressProvider, network)
    );

    if (existingProvider != undefined && !continuation) {
      console.log('Configured provider:', existingProvider);
      return;
    }

    const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
    const registryOwner = getParamPerNetwork(poolConfig.ProviderRegistryOwner, network);

    let registry: AddressesProviderRegistry;
    let newRegistry = false;

    if (!falsyOrZeroAddress(registryAddress)) {
      console.log('Configured registry:', registryAddress);

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
    } else if (continuation) {
      registry = await getAddressesProviderRegistry();
    } else {
      newRegistry = true;
      registry = await deployAddressesProviderRegistry(verify);
      console.log('Deployed registry:', registry.address);

      if (!falsyOrZeroAddress(registryOwner)) {
        await waitTx(registry.setOneTimeRegistrar(deployer.address, ProviderId));
        await waitTx(registry.transferOwnership(registryOwner!));
        console.log('Registry ownership transferred to:', registryOwner);
      }
    }

    let addressProvider: MarketAccessController;
    if (continuation) {
      addressProvider = existingProvider!;
      console.log('Continued with registry:', registry.address);
      console.log('Continued with provider:', addressProvider.address);
    } else {
      console.log('Deploy MarketAccessController');
      addressProvider = await deployMarketAccessControllerNoSave(MarketId);
      await waitForTx(addressProvider.deployTransaction);

      await waitTx(addressProvider.setAnyRoleMode(false));
      console.log('Deployed provider:', addressProvider.address);

      await waitTx(addressProvider.setTemporaryAdmin(deployer.address, 1000));

      const providerOwner = getParamPerNetwork(poolConfig.AddressProviderOwner, network);
      if (!falsyOrZeroAddress(providerOwner)) {
        await waitTx(addressProvider.transferOwnership(providerOwner!));
        console.log('Provider ownership transferred to:', providerOwner);
      } else if (!falsyOrZeroAddress(registryOwner)) {
        await waitTx(addressProvider.transferOwnership(registryOwner!));
        console.log('Provider ownership transferred to:', registryOwner);
      }

      await waitTx(registry.prepareAddressesProvider(addressProvider.address));

      // Since this moment continuation can be detected
      registerAndVerify(addressProvider, eContractid.MarketAccessController, [MarketId], verify);
    }

    const id = await registry.getAddressesProviderIdByAddress(addressProvider.address);
    if (!id.eq(0)) {
      throw 'deployment was already finished';
    }

    const emergencyAdmin = getParamPerNetwork(poolConfig.EmergencyAdmin, network);
    if (!falsyOrZeroAddress(emergencyAdmin)) {
      await waitTx(addressProvider.grantRoles(emergencyAdmin!, AccessFlags.EMERGENCY_ADMIN));
    }

    await mustWaitTx(
      addressProvider.grantRoles(
        deployer.address,
        AccessFlags.LENDING_RATE_ADMIN |
          AccessFlags.POOL_ADMIN |
          AccessFlags.STAKE_ADMIN |
          AccessFlags.REWARD_CONFIG_ADMIN |
          AccessFlags.REWARD_RATE_ADMIN |
          AccessFlags.ORACLE_ADMIN
      )
    );
  }
);
