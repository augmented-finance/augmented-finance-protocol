import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  deployStakeConfiguratorImpl,
  deployWETHGateway,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { getMarketAddressController } from '../../helpers/contracts-getters';
import { StakeConfigurator } from '../../types';
import { waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';

const CONTRACT_NAME = 'StakeConfigurator';

task(`full:deploy-stake-configurator`, `Deploys the ${CONTRACT_NAME} contract for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getMarketAddressController();

    const impl = await deployStakeConfiguratorImpl(verify);
    await waitForTx(await addressesProvider.addImplementation(`${CONTRACT_NAME}`, impl.address));
    await waitForTx(await addressesProvider.setStakeConfiguratorImpl(impl.address));

    console.log(`${CONTRACT_NAME}.address`, impl.address, AccessFlags.STAKE_CONFIGURATOR);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
