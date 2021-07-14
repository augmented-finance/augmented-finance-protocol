import { task } from 'hardhat/config';
import {
  deployATokensAndRatesHelper,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
  deployStableAndVariableTokensHelper,
} from '../../helpers/contracts-deployments';
import { eContractid } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  getMarketAddressController,
  getLendingPoolProxy,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { insertContractAddressInDb } from '../../helpers/contracts-helpers';

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

    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
      await addressesProvider.getLendingPoolConfigurator()
    );

    // Deploy deployment helpers
    await deployStableAndVariableTokensHelper(
      [lendingPoolProxy.address, addressesProvider.address],
      verify
    );
    await deployATokensAndRatesHelper(
      [lendingPoolProxy.address, addressesProvider.address, lendingPoolConfiguratorProxy.address],
      verify
    );
  });
