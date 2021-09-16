import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { initReservePriceFeeds } from '../../helpers/init-helpers';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { addFullStep } from '../helpers/full-steps';

addFullStep(11, 'Initialize derived feeds', 'full:initialize-derived-feeds');

task('full:initialize-derived-feeds', 'Initializes derived feeds for lending pool reserves')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    await initReservePriceFeeds(addressProvider, ReservesConfig, reserveAssets, verify);
  });
