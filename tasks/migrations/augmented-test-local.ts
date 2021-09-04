import { task, types } from 'hardhat/config';
import {
  deployMarketAccessController,
  deployMockAgfToken,
  deployMockRewardFreezer,
  deployTeamRewardPool,
  deployMockTokenLocker,
  deployPermitFreezerRewardPool,
  deployTokenWeightedRewardPoolAGFSeparate,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, RAY } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';
import {
  ADAI_ADDRESS,
  CDAI_ADDRESS,
  slashingDefaultPercentage,
  stakingCooldownTicks,
  stakingUnstakeTicks,
} from './defaultTestDeployConfig';
import { AccessFlags } from '../../helpers/access-flags';

task('augmented:test-local', 'Deploy Augmented test contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addOptionalParam('teamRewardInitialRate', 'reward initialRate - bigNumber', 1, types.string)
  .addOptionalParam('teamRewardBaselinePercentage', 'baseline percentage - bigNumber', 0, types.int)
  .addOptionalParam('stakeCooldownTicks', 'staking cooldown ticks', stakingCooldownTicks, types.int)
  .addOptionalParam('stakeUnstakeTicks', 'staking unstake window ticks', stakingUnstakeTicks, types.int)
  .addOptionalParam('slashingPercentage', 'slashing default percentage', slashingDefaultPercentage, types.int)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async (
      {
        aDaiAddress,
        cDaiAddress,
        teamRewardInitialRate,
        teamRewardBaselinePercentage,
        stakeCooldownTicks,
        stakeUnstakeTicks,
        slashingPercentage,
        verify,
      },
      localBRE
    ) => {
      await localBRE.run('set-DRE');
      const [root, user1, user2, slasher] = await (<any>localBRE).ethers.getSigners();

      // console.log(`#1 deploying: Access Controller`);
      const ac = await deployMarketAccessController('marketId');
      await ac.setAnyRoleMode(true);
      // emergency admin + liquidity admin
      await ac.grantRoles(
        root.address,
        AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.STAKE_ADMIN | AccessFlags.EMERGENCY_ADMIN
      );
      await ac.grantAnyRoles(slasher.address, AccessFlags.LIQUIDITY_CONTROLLER);

      // console.log(`#2 deploying: mock AGF`);
      const agfToken = await deployMockAgfToken([ac.address, 'Reward token for testing', 'AGF'], verify);

      // console.log(`#3 deploying: RewardFreezer`);
      const rewardCtl = await deployMockRewardFreezer([ac.address, agfToken.address], verify);
      await rewardCtl.setFreezePercentage(0);

      const freezerRewardPool = await deployPermitFreezerRewardPool([rewardCtl.address, RAY, 0, 'burners'], verify);
      await waitForTx(await rewardCtl.addRewardPool(freezerRewardPool.address));

      // deploy token weighted reward pool, register in controller, separated pool for math tests
      const tokenWeightedRewardPoolSeparate = await deployTokenWeightedRewardPoolAGFSeparate(
        [rewardCtl.address, 100, 0],
        verify
      );
      await waitForTx(await rewardCtl.addRewardPool(tokenWeightedRewardPoolSeparate.address));
      await tokenWeightedRewardPoolSeparate.addRewardProvider(root.address, ONE_ADDRESS);

      // console.log(`#4 deploying: Team Reward Pool`);
      const teamRewardPool = await deployTeamRewardPool(
        [rewardCtl.address, teamRewardInitialRate, teamRewardBaselinePercentage, root.address],
        verify
      );
      await waitForTx(await rewardCtl.addRewardPool(teamRewardPool.address));

      // console.log(`#5 deploying: RewardedTokenLocker`);

      const basicLocker = await deployMockTokenLocker([rewardCtl.address, 1e6, 0, agfToken.address]);
      await waitForTx(await rewardCtl.addRewardPool(basicLocker.address));

      if (process.env.MAINNET_FORK === 'true') {
        // console.log(`#6 deploying: Migrator + Adapters`);
      }
    }
  );
