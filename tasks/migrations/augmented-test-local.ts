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
  deployZombieAdapter,
  deployZombieRewardPool,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, oneRay, RAY } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';
import { ADAI_ADDRESS, CDAI_ADDRESS, DAI_ADDRESS } from './defaultTestDeployConfig';

task('augmented:test-local', 'Deploy Augmented Migrator contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addFlag('withZombieAdapter', 'deploy with zombie adapter of aDai')
  .addFlag('withAAVEAdapter', 'deploy with AAVE adapter of aDai')
  .addOptionalParam('teamRewardInitialRate', 'reward initialRate - bigNumber', RAY, types.string)
  .addOptionalParam('teamRewardBaselinePercentage', 'baseline percentage - bigNumber', 0, types.int)
  .addOptionalParam('teamRewardUnlockBlock', 'unlock rewards from block', 1, types.int)
  .addOptionalParam(
    'teamRewardsFreezePercentage',
    'rewards controller freeze percentage (10k = 100%)',
    5000,
    types.int
  )
  .addOptionalParam('zombieRewardLimit', 'zombie reward limit', 5000, types.int)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async (
      {
        aDaiAddress,
        cDaiAddress,
        withZombieAdapter,
        withAAVEAdapter,
        teamRewardInitialRate,
        teamRewardBaselinePercentage,
        teamRewardUnlockBlock,
        teamRewardsFreezePercentage,
        zombieRewardLimit,
        verify,
      },
      localBRE
    ) => {
      await localBRE.run('set-DRE');
      const [root] = await localBRE.ethers.getSigners();

      console.log(`#1 deploying: Access Controller`);
      const ac = await deployAccessController();
      await ac.setEmergencyAdmin(root.address);

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

      console.log(`#4 deploying: Team Reward Pool, unlock at block: ${teamRewardUnlockBlock}`);
      const teamRewardPool = await deployTeamRewardPool(
        [rewardFreezer.address, teamRewardInitialRate, teamRewardBaselinePercentage, root.address],
        verify
      );
      await waitForTx(await rewardFreezer.admin_addRewardPool(teamRewardPool.address));
      await waitForTx(await teamRewardPool.setUnlockBlock(teamRewardUnlockBlock));

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

        // zombie (aDai used as a shitcoin)
        // const zAdapter = await deployZombieAdapter([migrator.address, aDaiAddress]);
        // const zrp = await deployZombieRewardPool(
        //   [rewardFreezer.address, [aDaiAddress], [{ rateRay: RAY, limit: RAY }]],
        //   verify
        // );
        //
        // await migrator.admin_registerAdapter(zAdapter.address);
        // await rewardFreezer.admin_addRewardPool(zrp.address);
        // await zrp.addRewardProvider(zAdapter.address, aDaiAddress);
        // await migrator.admin_setRewardPool(zAdapter.address, zrp.address);

        // aave
        const aaveAdapter = await deployAaveAdapter([migrator.address, aDaiAddress], verify);
        const aaveTokenAddr = await aaveAdapter.UNDERLYING_ASSET_ADDRESS();
        const arp = await deployMigratorWeightedRewardPool(
          [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed(), aaveTokenAddr],
          verify
        );

        await migrator.admin_registerAdapter(aaveAdapter.address);
        await rewardFreezer.admin_addRewardPool(arp.address);
        await arp.addRewardProvider(aaveAdapter.address, aaveTokenAddr);
        await migrator.admin_setRewardPool(aaveAdapter.address, arp.address);

        // comp
        // const compAdapter = await deployCompAdapter(
        //   [migrator.address, cDaiAddress, DAI_ADDRESS],
        //   verify
        // );
        // // const compTokenAddr = await compAdapter.UNDERLYING_ASSET_ADDRESS();
        // const crp = await deployMigratorWeightedRewardPool(
        //   [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed(), DAI_ADDRESS],
        //   verify
        // );
        //
        // await migrator.admin_registerAdapter(compAdapter.address);
        // await rewardFreezer.admin_addRewardPool(crp.address);
        // await crp.addRewardProvider(compAdapter.address, DAI_ADDRESS);
        // await migrator.admin_setRewardPool(compAdapter.address, crp.address);
      }
    }
  );
