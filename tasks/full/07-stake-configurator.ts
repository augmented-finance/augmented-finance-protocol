import { loadPoolConfig } from '../../helpers/configuration';
import { deployStakeConfiguratorImpl } from '../../helpers/contracts-deployments';
import { eContractid } from '../../helpers/types';
import { addContractAddrToJsonDb, addNamedToJsonDb, falsyOrZeroAddress } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';
import { getProxyAdmin, getStakeConfiguratorImpl } from '../../helpers/contracts-getters';

const CONTRACT_NAME = 'StakeConfigurator';

deployTask(`full:deploy-stake-configurator`, `Deploy stake configurator`, __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
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

      {
        console.log(`Check proxy admin`);
        const sc = await getStakeConfiguratorImpl(stakeConfiguratorAddr);
        const pa = await sc.getProxyAdmin();
        if (falsyOrZeroAddress(pa)) {
          throw new Error('Missing proxy admin');
        } else {
          const padm = await getProxyAdmin(pa);
          const owner = await padm.owner();
          if (owner != sc.address) {
            throw new Error(`Invalid proxy admin owner: ${owner}, ${sc.address}`);
          }
          if (verify) {
            await addContractAddrToJsonDb(
              eContractid.ProxyAdmin + '-' + eContractid.StakeConfiguratorImpl,
              pa,
              true,
              []
            );
          }
        }
      }
    }

    console.log(`${CONTRACT_NAME}:`, stakeConfiguratorAddr);
  }
);
