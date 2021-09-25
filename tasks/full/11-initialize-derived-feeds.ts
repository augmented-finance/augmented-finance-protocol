import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { initReservePriceFeeds } from '../../helpers/init-helpers';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';

deployTask('full:initialize-derived-feeds', 'Initialize derived feeds', __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      Mocks: { UnderlyingMappings },
    } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const underlyingMappings = getParamPerNetwork(UnderlyingMappings, network);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    await initReservePriceFeeds(addressProvider, ReservesConfig, reserveAssets, underlyingMappings, verify);
  }
);
