import { task, types } from 'hardhat/config';
import {
  deployAccessController,
  deployMockAgfToken,
  deployMockStakedAgfToken,
  deployMockStakedAgToken,
  deployRewardBooster,
  deployRewardFreezer,
  deployTokenWeightedRewardPoolAG,
  deployTokenWeightedRewardPoolAGBoosted,
  deployTokenWeightedRewardPoolAGF,
  deployTokenWeightedRewardPoolAGFBoosted,
  deployTokenWeightedRewardPoolAGUSDCBoosted,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, oneRay, PERC_100, RAY, RAY_100, ZERO_ADDRESS } from '../../helpers/constants';
import {
  slashingDefaultPercentage,
  stakingCooldownBlocks,
  stakingUnstakeBlocks,
} from './defaultTestDeployConfig';
import { getAGTokenByName } from '../../helpers/contracts-getters';

task('augmented:test-local-staking', 'Deploy staking contracts')
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
      const [root, user1, user2, slasher, excessReceiverUser] = await localBRE.ethers.getSigners();

      console.log(`#1 deploying: Access Controller`);
      const ac = await deployAccessController();
      // emergency admin + liquidity admin
      await ac.setEmergencyAdmin(root.address);
      await ac.grantRoles(root.address, (1 << 5) | (1 << 25) | (1 << 24) | (1 << 27) | (1 << 3));
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
      const xAGPool = await deployTokenWeightedRewardPoolAG(
        [rewardFreezer.address, RAY, 0, RAY_100],
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

      const xAGFPool = await deployTokenWeightedRewardPoolAGF(
        [rewardFreezer.address, RAY, 0, RAY_100],
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

      console.log('#5 Staking boosters');
      const boosterController = await deployRewardBooster([ac.address, agfToken.address]);
      // agDAI pool
      const agDAIPoolBoosted = await deployTokenWeightedRewardPoolAGBoosted(
        [boosterController.address, RAY, 0, RAY_100],
        verify
      );
      await agDAIPoolBoosted.connect(root).addRewardProvider(root.address, agDaiToken.address);

      //agUSDC pool
      const agUSDC = await getAGTokenByName('agUSDC');
      const agUSDCPoolBoosted = await deployTokenWeightedRewardPoolAGUSDCBoosted(
        [boosterController.address, RAY, 0, RAY_100],
        verify
      );
      await agUSDCPoolBoosted.connect(root).addRewardProvider(root.address, agUSDC.address);

      // booster reward pool
      const AGFPoolBooster = await deployTokenWeightedRewardPoolAGFBoosted(
        [boosterController.address, RAY, 0, RAY_100],
        verify
      );
      await AGFPoolBooster.connect(root).addRewardProvider(root.address, xAGF.address);

      await boosterController.connect(root).admin_addRewardPool(agDAIPoolBoosted.address);
      await boosterController.connect(root).admin_addRewardPool(agUSDCPoolBoosted.address);
      await boosterController.connect(root).admin_addRewardPool(AGFPoolBooster.address);

      await boosterController.connect(root).setBoostPool(AGFPoolBooster.address);
      // set boost factor for agDAI pool
      await boosterController.connect(root).setBoostFactor(agDAIPoolBoosted.address, PERC_100);
      // set boost factor for agUSDC pool
      await boosterController.connect(root).setBoostFactor(agUSDCPoolBoosted.address, PERC_100);

      await boosterController.connect(root).setBoostExcessTarget(excessReceiverUser.address, true);
    }
  );
