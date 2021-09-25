import { loadPoolConfig } from '../../helpers/configuration';
import { deployStakeConfiguratorImpl } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';

const CONTRACT_NAME = 'StakeConfigurator';

deployTask(`full:deploy-stake-configurator`, `Deploy stake configurator`, __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // StakeConfigurator is always updated
    let stakeConfiguratorAddr =
      freshStart && continuation ? await addressProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR) : '';

    if (falsyOrZeroAddress(stakeConfiguratorAddr)) {
      console.log(`Deploy ${CONTRACT_NAME}`);
      const impl = await deployStakeConfiguratorImpl(verify, continuation);
      console.log(`${CONTRACT_NAME} implementation:`, impl.address);
      stakeConfiguratorAddr = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.STAKE_CONFIGURATOR,
        impl.address
      );
    }

    console.log(`${CONTRACT_NAME}:`, stakeConfiguratorAddr);
  }
);
