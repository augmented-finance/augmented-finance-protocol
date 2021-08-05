import { task } from 'hardhat/config';
import {
  deployLendingPoolExtensionImpl,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';
import { getLendingPoolProxy } from '../../helpers/contracts-getters';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';

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
      lpAddress = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.LENDING_POOL,
        lendingPoolImpl.address
      );
    }

    const lendingPoolProxy = await getLendingPoolProxy(lpAddress);
    console.log('Lending pool:', lpAddress);

    let lpExt = newLendingPool ? '' : await lendingPoolProxy.getLendingPoolExtension();
    if (falsyOrZeroAddress(lpExt)) {
      console.log('\tDeploying collateral manager...');
      const poolExtension = await deployLendingPoolExtensionImpl(verify, continuation);
      await addressProvider.grantRoles(await deployer.getAddress(), AccessFlags.POOL_ADMIN);
      await lendingPoolProxy.setLendingPoolExtension(poolExtension.address);
      lpExt = poolExtension.address;
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

      lpConfigurator = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.LENDING_POOL_CONFIGURATOR,
        lendingPoolConfiguratorImpl.address
      );
    }

    console.log('Lending pool configurator:', lpConfigurator);
  });
