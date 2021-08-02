import { task } from 'hardhat/config';
import {
  deployLendingPoolExtensionImpl,
  deployLendingPoolConfiguratorImpl,
  deployMockLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';
import { getMarketAddressController, getLendingPoolProxy } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';

task('dev:deploy-lending-pool', 'Deploy lending pool for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const addressesProvider = await getMarketAddressController();

    const lendingPoolImpl = await deployMockLendingPoolImpl(verify);
    const poolExtensionImpl = await deployLendingPoolExtensionImpl(verify, false);

    // Set lending pool impl to Address Provider
    await waitForTx(
      await addressesProvider.setAddressAsProxy(AccessFlags.LENDING_POOL, lendingPoolImpl.address)
    );

    const address = await addressesProvider.getLendingPool();
    const lendingPoolProxy = await getLendingPoolProxy(address);

    console.log(
      '\tSetting lending pool collateral manager implementation with address',
      poolExtensionImpl.address
    );
    await waitForTx(await lendingPoolProxy.setLendingPoolExtension(poolExtensionImpl.address));

    const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(verify, false);

    // Set lending pool conf impl to Address Provider
    await waitForTx(
      await addressesProvider.setAddressAsProxy(
        AccessFlags.LENDING_POOL_CONFIGURATOR,
        lendingPoolConfiguratorImpl.address
      )
    );
  });
