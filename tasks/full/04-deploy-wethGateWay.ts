import { loadPoolConfig } from '../../helpers/configuration';
import { deployWETHGateway } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';

deployTask(`full:deploy-weth-gateway`, `Deploy native currency gateway`, __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const dependencies = getParamPerNetwork(poolConfig.Dependencies, network);
    const reserveAssets = getParamPerNetwork(poolConfig.ReserveAssets, network);

    if (!dependencies.WrappedNative) {
      console.log(`Native currency gateway skipped`);
      return;
    }
    const wrapToken = reserveAssets[dependencies.WrappedNative];
    if (falsyOrZeroAddress(wrapToken)) {
      throw new Error('Unknown native currency wrapper: ' + dependencies.WrappedNative);
    }

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();
    // WETHGateway is NOT updated for existing installations
    let wgAddress = freshStart && !continuation ? '' : await addressProvider.getAddress(AccessFlags.WETH_GATEWAY);

    if (falsyOrZeroAddress(wgAddress)) {
      console.log(`Native currency wrapper:`, dependencies.WrappedNative, wrapToken);
      const impl = await deployWETHGateway([addressProvider.address, wrapToken], verify);

      console.log(`Deployed gateway address`, impl.address);
      wgAddress = impl.address;
      await mustWaitTx(addressProvider.setAddress(AccessFlags.WETH_GATEWAY, wgAddress));
    }

    console.log(`Native currency gateway:`, wgAddress, dependencies.WrappedNative);
  }
);
