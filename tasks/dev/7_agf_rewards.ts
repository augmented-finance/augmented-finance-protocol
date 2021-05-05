import { task } from 'hardhat/config';
import {
  deployMockAgfToken,
  deployLinearUnweightedRewardPool,
  deployRewardFreezer,
} from '../../helpers/contracts-deployments';

import { getAccessController } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { RAY, ZERO_ADDRESS } from '../../helpers/constants';

task('dev:agf-rewards', 'Deploy AGF token and reward pool.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    // Mock token doesn't check access
    const agfToken = await deployMockAgfToken(
      [ZERO_ADDRESS, 'Reward token updated', 'AGF'],
      verify
    );

    // FIXME:
    // use access controller and non-mock token when ready
    const rewardFreezer = await deployRewardFreezer([agfToken.address], verify);

    const linearUnweightedRewardPool = await deployLinearUnweightedRewardPool(
      [rewardFreezer.address, RAY, 0, ZERO_ADDRESS],
      verify
    );

    await waitForTx(await rewardFreezer.admin_addRewardPool(linearUnweightedRewardPool.address));
  });
