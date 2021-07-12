import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployAddressesProviderRegistry } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { loadPoolConfig } from '../../helpers/configuration';
import { isAddress } from 'ethers/lib/utils';
import { isZeroAddress } from 'ethereumjs-util';

task('full:deploy-address-provider-registry', 'Deploy address provider registry')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    let providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);

    if (
      !providerRegistryAddress ||
      !isAddress(providerRegistryAddress) ||
      isZeroAddress(providerRegistryAddress)
    ) {
      const contract = await deployAddressesProviderRegistry(verify);
      console.log('Deployed Registry Address:', contract.address);
    }
  });
