import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import { deployWETHGateway } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

const CONTRACT_NAME = 'WETHGateway';

task(`full-deploy-weth-gateway`, `Deploys the ${CONTRACT_NAME} contract for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();
    // WETHGateway is NOT updated for existing installations
    let wgAddress =
      freshStart && !continuation ? '' : await addressProvider.getAddress(AccessFlags.WETH_GATEWAY);

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
  });
