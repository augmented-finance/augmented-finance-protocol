import { task } from 'hardhat/config';
import {
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { getMarketAddressController, getLendingPoolProxy } from '../../helpers/contracts-getters';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { AccessFlags } from '../../helpers/access-flags';

task('full:deploy-lending-pool', 'Deploy lending pool for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const deployer = await getFirstSigner();
    const addressesProvider = await getMarketAddressController();

    console.log('\tDeploying lending pool, collateral manager & libraries...');
    const [lendingPoolImpl, collateralManagerImpl] = await deployLendingPoolImpl(verify);
    console.log('\tLending pool:', lendingPoolImpl.address);
    await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

    const lendingPoolProxy = await getLendingPoolProxy(await addressesProvider.getLendingPool());

    console.log('\tDeploying collateral manager...');
    console.log('\tCollateral manager:', collateralManagerImpl.address);
    await addressesProvider.grantRoles(await deployer.getAddress(), AccessFlags.POOL_ADMIN);
    await lendingPoolProxy.setLendingPoolCollateralManager(collateralManagerImpl.address);

    console.log('\tDeploying configurator...');
    const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(verify);
    console.log('\tLending pool configurator:', lendingPoolConfiguratorImpl.address);

    await waitForTx(
      await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
    );
  });
