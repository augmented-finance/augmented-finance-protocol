import { task, types } from 'hardhat/config';
import {
  deployAccessController,
  deployMockAgfToken,
  deployMockStakedAgfToken,
  deployMockStakedAgToken,
  deployRewardFreezer,
  deployTokenWeightedRewardPoolAG,
  deployTokenWeightedRewardPoolAGF,
} from '../../helpers/contracts-deployments';
import { oneRay, RAY, ZERO_ADDRESS } from '../../helpers/constants';
import {
  slashingDefaultPercentage,
  stakingCooldownBlocks,
  stakingUnstakeBlocks,
} from './defaultTestDeployConfig';
import { getAGTokenByName } from '../../helpers/contracts-getters';

task('augmented:test-local-staking', 'Deploy Augmented Migrator contracts.')
  .addOptionalParam(
    'stakeCooldownBlocks',
    'staking cooldown blocks',
    stakingCooldownBlocks,
    types.int
  )
  .addOptionalParam('stakeUnstakeBlocks', 'staking unstake blocks', stakingUnstakeBlocks, types.int)
  .addOptionalParam(
    'slashingPercentage',
    'slashing default percentage',
    slashingDefaultPercentage,
    types.int
  )
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async ({ stakeCooldownBlocks, stakeUnstakeBlocks, slashingPercentage, verify }, localBRE) => {
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

      console.log(`#4 Staking`);
      const agDaiToken = await getAGTokenByName('agDAI');
      await deployTokenWeightedRewardPoolAG(
        [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed()],
        verify
      );
      const xAG = await deployMockStakedAgToken([
        ac.address,
        agDaiToken.address,
        'Staked AG Token',
        'xAG',
        stakeCooldownBlocks,
        stakeUnstakeBlocks,
        ZERO_ADDRESS,
      ]);
      await xAG.connect(root).setMaxSlashablePercentage(slashingPercentage);

      await deployTokenWeightedRewardPoolAGF(
        [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed()],
        verify
      );

      const xAGF = await deployMockStakedAgfToken([
        ac.address,
        agfToken.address,
        'Staked AGF Token',
        'xAGF',
        stakeCooldownBlocks,
        stakeUnstakeBlocks,
        ZERO_ADDRESS,
      ]);
      await xAGF.connect(root).setMaxSlashablePercentage(slashingPercentage);
    }
  );
