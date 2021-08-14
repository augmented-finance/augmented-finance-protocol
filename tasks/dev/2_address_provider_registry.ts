import { task } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { deployMarketAccessController, deployAddressesProviderRegistry } from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';
import { TestConfig } from '../../markets/augmented';

task('dev:deploy-address-provider', 'Deploy address provider, registry and fee provider for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const admin = await (await localBRE.ethers.getSigners())[0].getAddress();

    const marketId = TestConfig.MarketId;
    const addressProvider = await deployMarketAccessController(marketId, verify);
    await waitForTx(await addressProvider.grantRoles(admin, AccessFlags.POOL_ADMIN));

    const addressesProviderRegistry = await deployAddressesProviderRegistry(verify);
    await waitForTx(await addressesProviderRegistry.registerAddressesProvider(addressProvider.address, marketId));
  });
