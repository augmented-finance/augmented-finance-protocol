import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eNetwork } from '../../helpers/types';
import { loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import {
  getAddressesProviderRegistry,
  getMarketAccessController,
  hasAddressProviderRegistry,
} from '../../helpers/contracts-getters';
import { AddressesProviderRegistry } from '../../types';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber } from '@ethersproject/bignumber';

task('full:deploy-finalize', 'Finalizes deployment and revokes temporary permissions')
  .addFlag('register', 'Register access controller with the registry')
  .setAction(async ({ register, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const addressProvider = await getMarketAccessController();
    await mustWaitTx(addressProvider.renounceTemporaryAdmin());
    console.log('Temporary admin permissions renounced');

    let registry: AddressesProviderRegistry;
    if (hasAddressProviderRegistry()) {
      registry = await getAddressesProviderRegistry();
    } else {
      const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
      if (falsyOrZeroAddress(registryAddress)) {
        throw 'registry address is unknown';
      }
      registry = await getAddressesProviderRegistry(registryAddress);
    }

    let registered = false;
    if (register) {
      let ProviderId = BigNumber.from(poolConfig.ProviderId);
      const id = await registry.getAddressesProviderIdByAddress(addressProvider.address);

      if (ProviderId.eq(0)) {
        if (!id.eq(0)) {
          ProviderId = id;
        } else {
          ProviderId = (await findMaxProviderId(registry)).add(1);
        }
      }

      if (!id.eq(ProviderId)) {
        console.log('Register provider with id: ', ProviderId.toString());
        await mustWaitTx(registry.registerAddressesProvider(addressProvider.address, ProviderId));
        registered = true;
      }
    }

    if (!registered) {
      await mustWaitTx(registry.renounceOneTimeRegistrar());
      console.log('Registrar permissions renounced');
    }

    const activeGrantees = async (flag: AccessFlags) => {
      const result = await addressProvider.roleActiveGrantees(flag);
      return result.addrList.slice(0, result.count.toNumber());
    };

    console.log('Pool Admin(s):', await activeGrantees(AccessFlags.POOL_ADMIN));
    console.log('Emergency Admin(s):', await activeGrantees(AccessFlags.EMERGENCY_ADMIN));
  });

const findMaxProviderId = async (registry: AddressesProviderRegistry): Promise<BigNumber> => {
  let ProviderId = BigNumber.from(0);

  for (const addr of await registry.getAddressesProvidersList()) {
    if (falsyOrZeroAddress(addr)) {
      continue;
    }
    const knownId = await registry.getAddressesProviderIdByAddress(addr);
    if (ProviderId.lt(knownId)) {
      ProviderId = knownId;
    }
  }
  return ProviderId;
};
