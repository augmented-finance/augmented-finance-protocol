import { task } from 'hardhat/config';
import {
  deployAGFToken,
  deployLinearUnweightedRewardPool,
  deployRewardFreezer,
} from '../../helpers/contracts-deployments';

import { getAccessController } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';

task('dev:agf-rewards', 'Deploy AGF token and reward pool.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const accessController = await getAccessController();
    const agfToken = await deployAGFToken(verify);
    await agfToken.initialize(
      accessController.address,
      'Augmented finance governance token',
      'AGF'
    );

    const rewardFreezer = await deployRewardFreezer([agfToken.address], verify);
    // FIXME:
    // await agfToken.admin_grant(rewardFreezer.address, 1); // AGFToken.aclMint

    const linearUnweightedRewardPool = await deployLinearUnweightedRewardPool(
      [rewardFreezer.address],
      verify
    );

    await waitForTx(
      await rewardFreezer.admin_addRewardPool(linearUnweightedRewardPool.address, ZERO_ADDRESS)
    );
  });
