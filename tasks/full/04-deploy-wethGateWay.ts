import { loadPoolConfig, getWethAddress } from '../../helpers/configuration';
import { deployWETHGateway } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';

const CONTRACT_NAME = 'WETHGateway';

deployTask(`full:deploy-weth-gateway`, `Deploy WETH Gateway`, __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();
    // WETHGateway is NOT updated for existing installations
    let wgAddress = freshStart && !continuation ? '' : await addressProvider.getAddress(AccessFlags.WETH_GATEWAY);

    if (falsyOrZeroAddress(wgAddress)) {
      const Weth = await getWethAddress(poolConfig);
      if (falsyOrZeroAddress(Weth)) {
        throw 'WETH address is missing';
      }

      const impl = await deployWETHGateway([addressProvider.address, Weth], verify);

      console.log(`Deployed ${CONTRACT_NAME}.address`, impl.address);
      wgAddress = impl.address;
      await mustWaitTx(addressProvider.setAddress(AccessFlags.WETH_GATEWAY, wgAddress));
    }

    console.log(`${CONTRACT_NAME}:`, wgAddress);
  }
);
