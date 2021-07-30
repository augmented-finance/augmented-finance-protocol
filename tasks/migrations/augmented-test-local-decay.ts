import { task } from 'hardhat/config';
import {
  deployMockAgfToken,
  deployMockRewardBooster,
  deployMockDecayingTokenLocker,
  deployMarketAccessController,
} from '../../helpers/contracts-deployments';
import { MAX_LOCKER_PERIOD, RAY_100, WEEK } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';
import { AccessFlags, ACCESS_REWARD_MINT } from '../../helpers/access-flags';

task('augmented:test-local-decay', 'Deploy Augmented test contracts').setAction(
  async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    const [root, user1, user2, slasher] = await (<any>localBRE).ethers.getSigners();

    console.log(`#1 deploying: Access Controller`);
    const ac = await deployMarketAccessController('marketId');
    await ac.setAnyRoleMode(true);
    // emergency admin + liquidity admin
    await ac.grantRoles(
      root.address,
      AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.STAKE_ADMIN | AccessFlags.EMERGENCY_ADMIN
    );
    await ac.grantRoles(root.address, ACCESS_REWARD_MINT);
    await ac.grantAnyRoles(slasher.address, AccessFlags.LIQUIDITY_CONTROLLER);

    console.log(`#2 deploying: mock AGF`);
    const agfToken = await deployMockAgfToken(
      [ac.address, 'Reward token for testing', 'AGF'],
      verify
    );

    console.log(`#3 deploying: RewardBooster`);
    const rewardBooster = await deployMockRewardBooster([ac.address, agfToken.address], verify);
    await ac.setAddress(AccessFlags.REWARD_CONTROLLER, rewardBooster.address); // do not use proxy

    console.log(`#5 deploying: DecayingTokenLocker for RewardBooster`);

    const decayLocker = await deployMockDecayingTokenLocker([
      rewardBooster.address,
      1e6,
      0,
      agfToken.address,
      WEEK,
      MAX_LOCKER_PERIOD,
      RAY_100,
    ]);
    await waitForTx(await rewardBooster.addRewardPool(decayLocker.address));
  }
);
