import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import { deployStakeConfiguratorImpl } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { getMarketAddressController } from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

const CONTRACT_NAME = 'StakeConfigurator';

task(`full:deploy-stake-configurator`, `Deploys the ${CONTRACT_NAME} contract for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    console.log(`Deploy ${CONTRACT_NAME}`);

    // StakeConfigurator is always updated
    let stakeConfiguratorAddr =
      freshStart && continuation ? await addressProvider.getStakeConfigurator() : '';

    if (falsyOrZeroAddress(stakeConfiguratorAddr)) {
      const impl = await deployStakeConfiguratorImpl(verify, continuation);
      console.log(`${CONTRACT_NAME} implementation:`, impl.address);
      await waitForTx(await addressProvider.setStakeConfiguratorImpl(impl.address));

      stakeConfiguratorAddr = await addressProvider.getStakeConfigurator();
    }

    console.log(`${CONTRACT_NAME}:`, stakeConfiguratorAddr);
  });
