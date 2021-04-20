import { task } from 'hardhat/config';
import {
  deployLendingPoolAddressesProvider,
  deployAddressesProviderRegistry,
} from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';
import AugmentedConfig from '../../markets/augmented';

task(
  'dev:deploy-address-provider',
  'Deploy address provider, registry and fee provider for dev enviroment'
)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const admin = await (await localBRE.ethers.getSigners())[0].getAddress();

    const addressesProvider = await deployLendingPoolAddressesProvider(
      AugmentedConfig.MarketId,
      verify
    );
    await waitForTx(await addressesProvider.setPoolAdmin(admin));

    const addressesProviderRegistry = await deployAddressesProviderRegistry(verify);
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
    );
  });
