import { task } from 'hardhat/config';
import { deployProtocolDataProvider } from '../../helpers/contracts-deployments';
import { AccessFlags } from '../../helpers/access-flags';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { ConfigNames } from '../../helpers/configuration';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:data-provider', 'Deploys UI data provider')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // ProtocolDataProvider is updated for existing installations
    let dhAddress =
      freshStart && continuation ? await addressProvider.getAddress(AccessFlags.DATA_HELPER) : '';

    if (falsyOrZeroAddress(dhAddress)) {
      const dataHelper = await deployProtocolDataProvider(addressProvider.address, verify);
      await mustWaitTx(addressProvider.setAddress(AccessFlags.DATA_HELPER, dataHelper.address));
      dhAddress = dataHelper.address;
    }

    console.log('Data helper:', dhAddress);
  });