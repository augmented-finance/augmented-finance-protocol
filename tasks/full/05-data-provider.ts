import { task } from 'hardhat/config';
import { deployProtocolDataProvider } from '../../helpers/contracts-deployments';
import { exit } from 'process';
import { getMarketAddressController } from '../../helpers/contracts-getters';

task('full:data-provider', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const addressesProvider = await getMarketAddressController();

    await deployProtocolDataProvider(addressesProvider.address, verify);
  });
