import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardFreezer,
  getZombieRewardPool,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, ZombieRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from './utils';
import { ONE_ADDRESS, RAY } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let zombieRewardPool: ZombieRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let blkAfterDeploy;
  let teamRewardInitialRate: string = RAY;
  let teamRewardsFreezePercentage = 0;

  before(async () => {
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('dev:agf-rewards', {
      teamRewardInitialRate: teamRewardInitialRate,
      teamRewardBaselinePercentage: 0,
      teamRewardUnlockBlock: 1000,
      teamRewardsFreezePercentage: teamRewardsFreezePercentage,
    });
    rewardController = await getRewardFreezer();
    zombieRewardPool = await getZombieRewardPool();
    agf = await getMockAgfToken();
    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('can claim reward', async () => {
    const rewardUpdate = 2000;
    expect(await agf.balanceOf(user1.address)).to.eq(0);
    await waitForTx(
      await zombieRewardPool.handleBalanceUpdate(
        ONE_ADDRESS,
        user1.address,
        0,
        rewardUpdate,
        100000
      )
    );
    // await mineToBlock(20);
    await waitForTx(await rewardController.connect(user1).claimReward());
    expect(await agf.balanceOf(user1.address)).to.eq(rewardUpdate);
  });
});
