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
import { mineToBlock } from './utils';
import { HALF_RAY, ONE_ADDRESS, PERC_100, RAY } from '../../helpers/constants';
import { createRandomAddress } from '../../helpers/misc-utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

describe('Zombie rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let zrp: ZombieRewardPool;
  let rc: RewardFreezer;
  let agf: MockAgfToken;
  let zombieRewardLimit = 5000;
  // TODO: needed for override
  let overrideStubVar = 0;
  let defaultReward = 2000;

  beforeEach(async () => {
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardFreezer();
    zrp = await getZombieRewardPool();
    agf = await getMockAgfToken();
  });

  it('can not register provider with unknown token', async () => {
    const unknownToken = createRandomAddress();
    await expect(rc.addRewardProvider(zrp.address, root.address, unknownToken)).to.be.revertedWith(
      'revert unknown token'
    );
  });

  it('multiple claims', async () => {
    await zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar);
    await mineToBlock(20);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward);
    await zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar);
    await mineToBlock(25);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(2 * defaultReward);
  });

  it('can claim reward only once', async () => {
    await zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar);
    await mineToBlock(20);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward);
    // claim again
    await mineToBlock(25);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward);
  });

  it('can claim reward with scaled update', async () => {
    await zrp.handleScaledBalanceUpdate(
      ONE_ADDRESS,
      user1.address,
      0,
      defaultReward,
      overrideStubVar,
      HALF_RAY
    );
    await mineToBlock(20);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward / 2);
  });

  it('can not claim reward after limit is reached', async () => {
    const rewardUpdateAmount = zombieRewardLimit + 1;
    await expect(
      zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, rewardUpdateAmount, overrideStubVar)
    ).to.be.revertedWith('revert insufficient reward pool balance');
  });

  it('can claim with frozen part', async () => {
    await rc.setFreezePercentage(PERC_100 / 2);
    await zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar);
    await mineToBlock(20);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward / 2);
  });

  it('can pause/unpause pool', async () => {
    await zrp.connect(root).setPaused(true);
    await expect(
      zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar)
    ).to.be.revertedWith('rewards are paused');
    await zrp.connect(root).setPaused(false);
    await zrp.handleBalanceUpdate(ONE_ADDRESS, user1.address, 0, defaultReward, overrideStubVar);
    await mineToBlock(20);
    await rc.connect(user1).claimReward();
    expect(await agf.balanceOf(user1.address)).to.eq(defaultReward);
  });
});
