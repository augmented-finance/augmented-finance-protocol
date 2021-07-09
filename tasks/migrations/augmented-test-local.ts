import { task, types } from 'hardhat/config';
import {
  deployAccessController,
  deployForwardingRewardPool,
  deployMockAgfToken,
  deployRewardController,
  deployTeamRewardPool,
  deployTokenLocker,
  deployPermitFreezerRewardPool,
  deployTokenWeightedRewardPoolAGFSeparate,
} from '../../helpers/contracts-deployments';
import { MAX_LOCKER_PERIOD, ONE_ADDRESS, RAY, RAY_100, WEEK } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';
import {
  ADAI_ADDRESS,
  CDAI_ADDRESS,
  DAI_ADDRESS,
  slashingDefaultPercentage,
  stakingCooldownTicks,
  stakingUnstakeTicks,
} from './defaultTestDeployConfig';
import { BigNumber } from 'ethers';

task('augmented:test-local', 'Deploy Augmented test contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addOptionalParam('teamRewardInitialRate', 'reward initialRate - bigNumber', RAY, types.string)
  .addOptionalParam('teamRewardBaselinePercentage', 'baseline percentage - bigNumber', 0, types.int)
  .addOptionalParam('stakeCooldownTicks', 'staking cooldown ticks', stakingCooldownTicks, types.int)
  .addOptionalParam(
    'stakeUnstakeTicks',
    'staking unstake window ticks',
    stakingUnstakeTicks,
    types.int
  )
  .addOptionalParam(
    'slashingPercentage',
    'slashing default percentage',
    slashingDefaultPercentage,
    types.int
  )
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
      const [root, user1, user2, slasher] = await localBRE.ethers.getSigners();

      console.log(`#1 deploying: Access Controller`);
      const ac = await deployAccessController();
      // emergency admin + liquidity admin
      await ac.setEmergencyAdmin(root.address);
      await ac.grantRoles(root.address, (1 << 3) | (1 << 5)); // REWARD_CONFIG_ADMIN | STAKE_ADMIN
      await ac.grantRoles(slasher.address, 1 << 15); // LIQUIDITY_CONTROLLER

      console.log(`#2 deploying: mock AGF`);
      const agfToken = await deployMockAgfToken(
        [ac.address, 'Reward token for testing', 'AGF'],
        verify
      );

      console.log(`#3 deploying: RewardFreezer`);
      const rewardCtl = await deployRewardController([ac.address, agfToken.address], verify);
      await rewardCtl.setFreezePercentage(0);

      const freezerRewardPool = await deployPermitFreezerRewardPool(
        [rewardCtl.address, RAY, 'burners'],
        verify
      );
      await waitForTx(await rewardCtl.addRewardPool(freezerRewardPool.address));

      // deploy token weighted reward pool, register in controller, separated pool for math tests
      const tokenWeightedRewardPoolSeparate = await deployTokenWeightedRewardPoolAGFSeparate(
        [rewardCtl.address, RAY_100, RAY, 0, RAY_100],
        verify
      );
      await waitForTx(await rewardCtl.addRewardPool(tokenWeightedRewardPoolSeparate.address));
      await tokenWeightedRewardPoolSeparate.addRewardProvider(root.address, ONE_ADDRESS);

      console.log(`#4 deploying: Team Reward Pool`);
      const teamRewardPool = await deployTeamRewardPool(
        [rewardCtl.address, teamRewardInitialRate, RAY, teamRewardBaselinePercentage, root.address],
        verify
      );
      await waitForTx(await rewardCtl.addRewardPool(teamRewardPool.address));

      console.log(`#5 deploying: RewardedTokenLocker + Forwarding Reward Pool`);

      // deploy token weighted reward pool, register in controller, separated pool for math tests
      const fwdRewardPool = await deployForwardingRewardPool(
        [rewardCtl.address, RAY, RAY, 0],
        verify
      );
      const basicLocker = await deployTokenLocker([
        ac.address,
        agfToken.address,
        WEEK,
        MAX_LOCKER_PERIOD,
        RAY_100,
      ]);
      await waitForTx(await rewardCtl.addRewardPool(fwdRewardPool.address));
      await basicLocker.setForwardingRewardPool(fwdRewardPool.address);
      await fwdRewardPool.addRewardProvider(basicLocker.address, ONE_ADDRESS);

      if (process.env.MAINNET_FORK === 'true') {
        // console.log(`#6 deploying: Migrator + Adapters`);
      }
    }
  );
