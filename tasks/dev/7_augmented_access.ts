import { task } from 'hardhat/config';
import { deployAccessController } from '../../helpers/contracts-deployments';

import { getFirstSigner } from '../../helpers/contracts-getters';

task('dev:augmented-access', 'Augmented protocol admin access permissions.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const admin = await getFirstSigner();
    const accessController = await deployAccessController(verify);
    // pool admin flag
    await accessController.grantRoles(admin.address, (1 << 3) | (1 << 10));
  });
