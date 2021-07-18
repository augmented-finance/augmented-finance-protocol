import { task } from 'hardhat/config';
import {
  deployLendingPoolCollateralManagerImpl,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { eContractid } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  getMarketAddressController,
  getLendingPoolProxy,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';

task('dev:deploy-lending-pool', 'Deploy lending pool for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const addressesProvider = await getMarketAddressController();

    const lendingPoolImpl = await deployLendingPoolImpl(verify);

    // Set lending pool impl to Address Provider
    await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

    const address = await addressesProvider.getLendingPool();
    const lendingPoolProxy = await getLendingPoolProxy(address);

    const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(verify);

    // Set lending pool conf impl to Address Provider
    await waitForTx(
      await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
    );

    const collateralManager = await deployLendingPoolCollateralManagerImpl(verify);
    console.log(
      '\tSetting lending pool collateral manager implementation with address',
      collateralManager.address
    );
    await waitForTx(
      await lendingPoolProxy.setLendingPoolCollateralManager(collateralManager.address)
    );
  });
