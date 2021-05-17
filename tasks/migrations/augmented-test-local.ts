import { task, types } from 'hardhat/config';
import {
  deployAaveAdapter,
  deployAccessController,
  deployAugmentedMigrator,
  deployMigratorWeightedRewardPool,
  deployMockAgfToken,
  deployRewardFreezer,
  deployTeamRewardPool,
  deployTokenUnweightedRewardPool,
  deployZombieAdapter,
  deployZombieRewardPool,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, oneRay, RAY } from '../../helpers/constants';
import { printContracts, waitForTx } from '../../helpers/misc-utils';
import { ADAI_ADDRESS, CDAI_ADDRESS } from './defaultTestDeployConfig';

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

        let adapter;
        let tokenAddr: string;
        let rp;
        if (withZombieAdapter) {
          adapter = await deployZombieAdapter([migrator.address, aDaiAddress]);
          tokenAddr = aDaiAddress;
          rp = await deployZombieRewardPool(
            [rewardFreezer.address, [tokenAddr], [{ rateRay: RAY, limit: RAY }]],
            verify
          );
        } else if (withAAVEAdapter) {
          adapter = await deployAaveAdapter([migrator.address, aDaiAddress], verify);
          tokenAddr = await adapter.UNDERLYING_ASSET_ADDRESS();
          rp = await deployMigratorWeightedRewardPool(
            [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed(), tokenAddr],
            verify
          );
        } else {
          throw Error('provide deployment flag: withZombieAdapter: true or withAAVEAdapter: true');
        }
        await migrator.admin_registerAdapter(adapter.address);
        await rewardFreezer.admin_addRewardPool(rp.address);
        await rp.addRewardProvider(adapter.address, tokenAddr);
        await migrator.admin_setRewardPool(adapter.address, rp.address);
      }
      printContracts();
    }
  );
