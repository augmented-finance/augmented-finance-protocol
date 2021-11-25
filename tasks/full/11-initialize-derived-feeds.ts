import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig } from '../../helpers/configuration';
import { ICommonConfiguration } from '../../helpers/types';
import { initReservePriceFeeds } from '../../helpers/init-helpers';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';

deployTask('full:initialize-derived-feeds', 'Initialize derived feeds', __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      Mocks: { UnderlyingMappings },
    } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets);
    const underlyingMappings = getParamPerNetwork(UnderlyingMappings);
    const reservesConfig = getParamPerNetwork(ReservesConfig);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    await initReservePriceFeeds(addressProvider, reservesConfig, reserveAssets, underlyingMappings, verify);
  }
);
