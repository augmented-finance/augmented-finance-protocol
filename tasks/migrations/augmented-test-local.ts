import { task, types } from 'hardhat/config';
import {
  deployAaveAdapter,
  deployAccessController,
  deployAugmentedMigrator,
  deployCompAdapter,
  deployMigratorWeightedRewardPool,
  deployMockAgfToken,
  deployRewardFreezer,
  deployTeamRewardPool,
  deployTokenUnweightedRewardPool,
  deployTokenWeightedRewardPoolAGFSeparate,
  deployZombieAdapter,
  deployZombieRewardPool,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, RAY, RAY_100 } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';
import {
  ADAI_ADDRESS,
  CDAI_ADDRESS,
  DAI_ADDRESS,
  slashingDefaultPercentage,
  stakingCooldownTicks,
  stakingUnstakeTicks,
  ZTOKEN_ADDRESS,
} from './defaultTestDeployConfig';

task('augmented:test-local', 'Deploy Augmented Migrator contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addOptionalParam('zTokenAddress', 'Zombie token address', ZTOKEN_ADDRESS, types.string)
  .addFlag('withZombieAdapter', 'deploy with zombie adapter of aDai')
  .addFlag('withAAVEAdapter', 'deploy with AAVE adapter of aDai')
  .addOptionalParam('teamRewardInitialRate', 'reward initialRate - bigNumber', RAY, types.string)
  .addOptionalParam('teamRewardBaselinePercentage', 'baseline percentage - bigNumber', 0, types.int)
  .addOptionalParam(
    'teamRewardsFreezePercentage',
    'rewards controller freeze percentage (10k = 100%)',
    5000,
    types.int
  )
  .addOptionalParam('zombieRewardLimit', 'zombie reward limit', 5000, types.int)
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
        zTokenAddress,
        withZombieAdapter,
        withAAVEAdapter,
        teamRewardInitialRate,
        teamRewardBaselinePercentage,
        teamRewardsFreezePercentage,
        zombieRewardLimit,
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
      await ac.grantRoles(root.address, 1 << 5);
      await ac.grantRoles(slasher.address, 1 << 15);

      console.log(`#2 deploying: mock AGF`);
      const agfToken = await deployMockAgfToken(
        [ac.address, 'Reward token updated', 'AGF'],
        verify
      );

      console.log(`#3 deploying: RewardController`);
      const rewardFreezer = await deployRewardFreezer([ac.address, agfToken.address], verify);
      await rewardFreezer.admin_setFreezePercentage(0);

      // deploy linear pool, register in controller
      const linearUnweightedRewardPool = await deployTokenUnweightedRewardPool(
        [rewardFreezer.address, RAY, 0],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(linearUnweightedRewardPool.address));

      // deploy token weighted reward pool, register in controller, separated pool for math tests
      const tokenWeightedRewardPoolSeparate = await deployTokenWeightedRewardPoolAGFSeparate(
        [rewardFreezer.address, RAY_100, 0, RAY_100],
        verify
      );
      await waitForTx(
        await rewardFreezer.admin_addRewardPool(tokenWeightedRewardPoolSeparate.address)
      );
      await tokenWeightedRewardPoolSeparate.addRewardProvider(root.address, ONE_ADDRESS);

      console.log(`#4 deploying: Team Reward Pool`);
      const teamRewardPool = await deployTeamRewardPool(
        [rewardFreezer.address, teamRewardInitialRate, teamRewardBaselinePercentage, root.address],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(teamRewardPool.address));

      console.log(`#5 deploying: Zombie Reward Pool`);
      const zombieRewardPool = await deployZombieRewardPool(
        [rewardFreezer.address, [ONE_ADDRESS], [{ rateRay: RAY, limit: zombieRewardLimit }]],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(zombieRewardPool.address));
      await waitForTx(
        await rewardFreezer.admin_addRewardProvider(
          zombieRewardPool.address,
          root.address,
          ONE_ADDRESS
        )
      );

      if (process.env.MAINNET_FORK === 'true') {
        console.log(`#6 deploying: Migrator`);
        const migrator = await deployAugmentedMigrator(verify);

        console.log(`#7 deploying: Zombie Adapter`);
        const zAdapter = await deployZombieAdapter([migrator.address, zTokenAddress]);
        const zrp = await deployZombieRewardPool(
          [rewardFreezer.address, [zTokenAddress], [{ rateRay: RAY, limit: RAY }]],
          verify
        );

        await migrator.admin_registerAdapter(zAdapter.address);
        await rewardFreezer.admin_addRewardPool(zrp.address);
        await zrp.addRewardProvider(zAdapter.address, zTokenAddress);
        await migrator.admin_setRewardPool(zAdapter.address, zrp.address);

        console.log(`#8 deploying: Aave Adapter`);
        const aaveAdapter = await deployAaveAdapter([migrator.address, aDaiAddress], verify);
        const underlyingToken = await aaveAdapter.UNDERLYING_ASSET_ADDRESS();
        console.log(`underlying deployment: ${underlyingToken}`);
        const arp = await deployMigratorWeightedRewardPool(
          [rewardFreezer.address, RAY, 0, RAY_100, underlyingToken],
          verify
        );

        await migrator.admin_registerAdapter(aaveAdapter.address);
        await rewardFreezer.admin_addRewardPool(arp.address);
        await arp.addRewardProvider(aaveAdapter.address, underlyingToken);
        await migrator.admin_setRewardPool(aaveAdapter.address, arp.address);

        console.log(`#9 deploying: Compound Adapter`);
        const compAdapter = await deployCompAdapter(
          [migrator.address, cDaiAddress, DAI_ADDRESS],
          verify
        );
        const crp = await deployMigratorWeightedRewardPool(
          [rewardFreezer.address, RAY, 0, RAY_100, DAI_ADDRESS],
          verify
        );

        await migrator.admin_registerAdapter(compAdapter.address);
        await rewardFreezer.admin_addRewardPool(crp.address);
        await crp.addRewardProvider(compAdapter.address, DAI_ADDRESS);
        await migrator.admin_setRewardPool(compAdapter.address, crp.address);
      }
    }
  );
