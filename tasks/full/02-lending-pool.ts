import { task } from 'hardhat/config';
import {
  deployLendingPoolCollateralManagerImpl,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { getLendingPoolProxy } from '../../helpers/contracts-getters';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:deploy-lending-pool', 'Deploy lending pool for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const deployer = await getFirstSigner();
    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // LendingPool will be updated for existing installations
    let lpAddress = freshStart && continuation ? await addressProvider.getLendingPool() : '';
    const newLendingPool = falsyOrZeroAddress(lpAddress);

    if (newLendingPool) {
      console.log('\tDeploying lending pool...');
      const lendingPoolImpl = await deployLendingPoolImpl(verify, continuation);
      console.log('\tLending pool implementation:', lendingPoolImpl.address);
      await waitForTx(await addressProvider.setLendingPoolImpl(lendingPoolImpl.address));
      lpAddress = await addressProvider.getLendingPool();
    }

    const lendingPoolProxy = await getLendingPoolProxy(lpAddress);
    console.log('Lending pool:', lpAddress);

    let lpExt = newLendingPool ? '' : await lendingPoolProxy.getLendingPoolCollateralManager();
    if (falsyOrZeroAddress(lpExt)) {
      console.log('\tDeploying collateral manager...');
      const collateralManager = await deployLendingPoolCollateralManagerImpl(verify, continuation);
      await addressProvider.grantRoles(await deployer.getAddress(), AccessFlags.POOL_ADMIN);
      await lendingPoolProxy.setLendingPoolCollateralManager(collateralManager.address);
      lpExt = collateralManager.address;
    }
    console.log('Collateral manager:', lpExt);

    let lpConfigurator = newLendingPool ? '' : await addressProvider.getLendingPoolConfigurator();

    if (falsyOrZeroAddress(lpConfigurator)) {
      console.log('\tDeploying configurator...');
      const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(
        verify,
        continuation
      );
      console.log(
        '\tLending pool configurator implementation:',
        lendingPoolConfiguratorImpl.address
      );

      await waitForTx(
        await addressProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
      );
      lpConfigurator = await addressProvider.getLendingPoolConfigurator();
    }

    console.log('Lending pool configurator:', lpConfigurator);
  });
