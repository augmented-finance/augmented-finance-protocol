import { task } from 'hardhat/config';
import { deployProtocolDataProvider } from '../../helpers/contracts-deployments';
import { getMarketAddressController } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { waitForTx } from '../../helpers/misc-utils';
import { ConfigNames } from '../../helpers/configuration';

task('full:data-provider', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const addressesProvider = await getMarketAddressController();

    const dataHelper = await deployProtocolDataProvider(addressesProvider.address, verify);
    await waitForTx(
      await addressesProvider.setAddress(AccessFlags.DATA_HELPER, dataHelper.address)
    );
  });
