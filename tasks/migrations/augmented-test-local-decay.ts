import { task, types } from 'hardhat/config';
import {
  deployAccessController,
  deployMockAgfToken,
  deployRewardBooster,
  deployForwardingRewardPoolDecay,
  deployDecayingTokenLocker,
} from '../../helpers/contracts-deployments';
import {
  MAX_LOCKER_PERIOD,
  ONE_ADDRESS,
  RAY,
  RAY_100,
  RAY_10000,
  WEEK,
} from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';

task('augmented:test-local-decay', 'Deploy Augmented test contracts').setAction(
  async ({ verify }, localBRE) => {
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

    console.log(`#3 deploying: RewardBooster`);
    const rewardBooster = await deployRewardBooster([ac.address, agfToken.address], verify);

    console.log(`#5 deploying: DecayingTokenLocker + ForwardingRewardPool for RewardBooster`);

    // deploy token weighted reward pool, register in controller, separated pool for math tests
    const fwdRewardPoolDecay = await deployForwardingRewardPoolDecay(
      [rewardBooster.address, RAY_10000, RAY, 0],
      verify
    );
    const decayLocker = await deployDecayingTokenLocker([
      ac.address,
      agfToken.address,
      WEEK,
      MAX_LOCKER_PERIOD,
      RAY_100,
    ]);
    await waitForTx(await rewardBooster.addRewardPool(fwdRewardPoolDecay.address));
    await decayLocker.setForwardingRewardPool(fwdRewardPoolDecay.address);
    await fwdRewardPoolDecay.addRewardProvider(decayLocker.address, ONE_ADDRESS);
  }
);
