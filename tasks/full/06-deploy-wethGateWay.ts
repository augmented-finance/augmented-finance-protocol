import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import { authorizeWETHGateway, deployWETHGateway } from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { getMarketAddressController } from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';

const CONTRACT_NAME = 'WETHGateway';

task(`full-deploy-weth-gateway`, `Deploys the ${CONTRACT_NAME} contract for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getMarketAddressController();

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    let gateWay = await addressesProvider.getAddress(AccessFlags.WETH_GATEWAY);

    if (falsyOrZeroAddress(gateWay)) {
      const Weth = await getWethAddress(poolConfig);
      if (falsyOrZeroAddress(Weth)) {
        throw 'WETH address is missing';
      }

      const impl = await deployWETHGateway([Weth], verify);

      console.log(`Deployed ${CONTRACT_NAME}.address`, impl.address);
      gateWay = impl.address;
    } else {
      console.log(`${CONTRACT_NAME} already deployed: ${gateWay}`);
    }

    await waitForTx(await addressesProvider.setAddress(AccessFlags.WETH_GATEWAY, gateWay));

    await authorizeWETHGateway(gateWay, await addressesProvider.getLendingPool());

    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
