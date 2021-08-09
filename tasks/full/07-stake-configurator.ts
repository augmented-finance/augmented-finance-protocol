import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { deployStakeConfiguratorImpl } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';

const CONTRACT_NAME = 'StakeConfigurator';

task(`full:deploy-stake-configurator`, `Deploys the ${CONTRACT_NAME} contract for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // StakeConfigurator is always updated
    let stakeConfiguratorAddr =
      freshStart && continuation
        ? await addressProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR)
        : '';

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
  });
