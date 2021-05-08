import { task, types } from 'hardhat/config';
import {
  deployMockAgfToken,
  deployLinearUnweightedRewardPool,
  deployRewardFreezer,
  deployTeamRewardPool,
} from '../../helpers/contracts-deployments';

import { waitForTx } from '../../helpers/misc-utils';
import { RAY, ZERO_ADDRESS } from '../../helpers/constants';

task('dev:agf-rewards', 'Deploy AGF token and reward pool.')
  .addOptionalParam('teamRewardInitialRate', 'reward initialRate - bigNumber', RAY, types.string)
  .addOptionalParam('teamRewardBaselinePercentage', 'baseline percentage - bigNumber', 0, types.int)
  .addOptionalParam('teamRewardUnlockBlock', 'unlock rewards from block', 1, types.int)
  .addOptionalParam(
    'teamRewardsFreezePercentage',
    'rewards controller freeze percentage (10k = 100%)',
    5000,
    types.int
  )
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async (
      {
        verify,
        teamRewardInitialRate,
        teamRewardBaselinePercentage,
        teamRewardUnlockBlock,
        teamRewardsFreezePercentage,
      },
      localBRE
    ) => {
      await localBRE.run('set-DRE');
      const [root] = await localBRE.ethers.getSigners();

      // Mock token doesn't check access
      const agfToken = await deployMockAgfToken(
        [ZERO_ADDRESS, 'Reward token updated', 'AGF'],
        verify
      );

      // FIXME:
      // use access controller and non-mock token when ready
      // rewardFreezer is reward controller
      const rewardFreezer = await deployRewardFreezer([ZERO_ADDRESS, agfToken.address], verify);
      await waitForTx(await rewardFreezer.admin_setFreezePercentage(teamRewardsFreezePercentage));

      // deploy linear pool, register in controller
      const linearUnweightedRewardPool = await deployLinearUnweightedRewardPool(
        [rewardFreezer.address, RAY, 0, ZERO_ADDRESS],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(linearUnweightedRewardPool.address));

      // deploy team pool, register in controller, set unlock at block
      const teamRewardPool = await deployTeamRewardPool(
        [rewardFreezer.address, teamRewardInitialRate, teamRewardBaselinePercentage, root.address],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(teamRewardPool.address));
      await waitForTx(await teamRewardPool.setUnlockBlock(teamRewardUnlockBlock));
    }
  );
