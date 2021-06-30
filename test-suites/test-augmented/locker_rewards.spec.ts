import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardFreezer,
  getXAgfToken,
  getForwardingRewardPool,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, ForwardingRewardPool, XAGFTokenV1 } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { waitForTx } from '../../helpers/misc-utils';
import { currentTick, mineToTicks, mineTicks, revertSnapshot, takeSnapshot } from './utils';
import { calcTeamRewardForMember } from './helpers/utils/calculations_augmented';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { BigNumber } from 'ethers';
import { RAY, RAY_100, RAY_10000, RAY_PER_WEEK } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Token locker suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let frp: ForwardingRewardPool;
  let rewardController: RewardFreezer;
  let AGF: MockAgfToken;
  let xAGF: XAGFTokenV1;
  let blkBeforeDeploy;
  const defaultStkAmount = 1e9;
  const DAY = 60 * 60 * 24;
  const WEEK = DAY * 7;
  const MIN_PERIOD = WEEK;
  const MAX_PERIOD = 4 * 52 * WEEK;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rewardController = await getRewardFreezer();
    rewardController.admin_setFreezePercentage(0);

    frp = await getForwardingRewardPool();
    AGF = await getMockAgfToken();
    xAGF = await getXAgfToken();

    await AGF.connect(root).mintReward(user1.address, defaultStkAmount, false);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);

    await AGF.connect(root).mintReward(user2.address, defaultStkAmount * 2, false);
    await AGF.connect(user2).approve(xAGF.address, defaultStkAmount * 2);
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('user1 locks and redeems', async () => {
    const defaultPeriod = WEEK;
    const lockTick = await currentTick();

    expect(await xAGF.totalSupply()).eq(0);
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);

    expect(await AGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.balanceOfUnderlying(user1.address)).eq(defaultStkAmount);

    const expectedBalanceMin = BigNumber.from(defaultStkAmount)
      .mul(MIN_PERIOD)
      .div(MAX_PERIOD)
      .toNumber();
    const actualBalance = (await xAGF.balanceOf(user1.address)).toNumber();
    expect(actualBalance).within(expectedBalanceMin / 2, (expectedBalanceMin * 3) / 2); // depends on current timestamp
    expect(await xAGF.totalSupply()).eq(actualBalance);

    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo.underlying).eq(defaultStkAmount);

    expect(lockInfo.availableSince).within(
      lockTick + defaultPeriod / 2,
      lockTick + (defaultPeriod * 3) / 2
    );

    await xAGF.connect(user1).redeem(user1.address);
    expect(await AGF.balanceOf(user1.address)).eq(0); // nothing to redeem yet

    await mineToTicks(lockInfo.availableSince);

    expect(await xAGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.balanceOfUnderlying(user1.address)).eq(defaultStkAmount);
    expect(await xAGF.totalOfUnderlying()).eq(defaultStkAmount);

    await xAGF.connect(user1).redeem(user1.address);

    expect(await AGF.balanceOf(user1.address)).eq(defaultStkAmount);
    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.balanceOfUnderlying(user1.address)).eq(0);
    expect(await xAGF.totalOfUnderlying()).eq(0);
  });

  it('user1 locks, user2 adds to it, user1 redeems', async () => {
    const defaultPeriod = 2 * WEEK;

    await expect(xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount)).to.be.revertedWith(
      'ADD_TO_LOCK_RESTRICTED'
    );

    await xAGF.connect(user1).allowAdd(user2.address, true);

    await expect(xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount)).to.be.revertedWith(
      'NOTHING_IS_LOCKED'
    );

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo.underlying).eq(defaultStkAmount);

    const initSupply = await xAGF.totalSupply();

    await mineTicks(1 * DAY);

    const prevSupply = await xAGF.totalSupply();
    expect(prevSupply).lte(initSupply);

    await xAGF.connect(user2).lockAdd(user1.address, 1);

    let lockInfoAdded = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfoAdded.availableSince).eq(lockInfo.availableSince); // adding funds doesn't move expiry
    expect(lockInfoAdded.underlying).eq(defaultStkAmount + 1);

    expect(await xAGF.totalSupply()).lt(prevSupply);

    await xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount - 1);

    lockInfoAdded = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfoAdded.availableSince).eq(lockInfo.availableSince); // adding funds doesn't move expiry
    expect(lockInfoAdded.underlying).eq(defaultStkAmount * 2);

    expect(await xAGF.totalSupply()).gt(initSupply);
    expect(await xAGF.totalOfUnderlying()).eq(defaultStkAmount * 2);

    await xAGF.connect(user1).redeem(user1.address);
    expect(await AGF.balanceOf(user1.address)).eq(0); // nothing to redeem yet

    await mineToTicks(lockInfo.availableSince);

    expect(await xAGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.totalOfUnderlying()).eq(defaultStkAmount * 2);

    await expect(xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount)).to.be.revertedWith(
      'NOTHING_IS_LOCKED'
    );

    await xAGF.connect(user1).redeem(user1.address);

    expect(await AGF.balanceOf(user1.address)).eq(defaultStkAmount * 2);
    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.balanceOfUnderlying(user1.address)).eq(0);
    expect(await xAGF.totalOfUnderlying()).eq(0);
  });

  it('user1 locks for 6 weeks, user2 locks for 3 weeks, both users redeem together with some delay', async () => {
    const defaultPeriod = 3 * WEEK;

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod * 2, 0);
    const balance1 = await xAGF.balanceOf(user1.address);
    expect(await xAGF.totalSupply()).eq(balance1);

    await xAGF.connect(user2).lock(defaultStkAmount, defaultPeriod, 0);
    expect(await xAGF.totalSupply()).gt(balance1);

    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user2.address);
    await mineToTicks(lockInfo.availableSince);

    expect(await xAGF.balanceOf(user1.address)).eq(balance1);
    expect(await xAGF.balanceOf(user2.address)).eq(0);
    expect(await xAGF.totalSupply()).eq(balance1);

    await mineTicks(defaultPeriod * 2);

    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.totalOfUnderlying()).eq(defaultStkAmount * 2);

    await xAGF.connect(user1).redeem(user1.address);
    await xAGF.connect(user2).redeem(user2.address);

    expect(await AGF.balanceOf(user1.address)).eq(defaultStkAmount);
    expect(await AGF.balanceOf(user2.address)).eq(defaultStkAmount * 2);

    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.balanceOf(user1.address)).eq(0);
    expect(await xAGF.balanceOfUnderlying(user1.address)).eq(0);
    expect(await xAGF.balanceOf(user2.address)).eq(0);
    expect(await xAGF.balanceOfUnderlying(user2.address)).eq(0);
    expect(await xAGF.totalOfUnderlying()).eq(0);
  });

  it('2 users with different time-values receive exact total reward', async () => {
    const defaultPeriod = 3 * WEEK;

    await AGF.connect(root).mintReward(root.address, defaultStkAmount, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount);

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod * 2, 0);
    const startedAt = await currentTick();

    await mineTicks(defaultPeriod / 2);
    await xAGF.connect(user2).lock(defaultStkAmount * 2, defaultPeriod, 0);

    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    await mineToTicks(lockInfo.availableSince + WEEK); // longer wait should not change the result

    await rewardController.connect(user1).claimReward();
    await rewardController.connect(user2).claimReward();

    let rewards = await AGF.balanceOf(user1.address);
    rewards = rewards.add(await AGF.balanceOf(user2.address));

    expect(rewards.toNumber()).approximately(lockInfo.availableSince - startedAt, 2);
  });

  it('2 users share excess, 3rd user misses it', async () => {
    await AGF.connect(root).mintReward(root.address, defaultStkAmount, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount);

    const rateBase = await xAGF.getRewardRate();

    await xAGF.connect(user1).lock(defaultStkAmount, 6 * WEEK, 0);
    const startedAt = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await xAGF.connect(user2).lock(defaultStkAmount * 2, 6 * WEEK, 0);
    const total12 = await xAGF.totalSupply();

    expect(await xAGF.getRewardRate()).eq(rateBase);

    await frp.connect(root).receiveBoostExcess(rateBase.mul(10000), 0); // 10000 will be distributed over 1 week or less

    expect(await xAGF.getRewardRate()).eq(rateBase);

    await mineTicks(3 * WEEK);

    await xAGF.connect(root).lock(defaultStkAmount, 2 * WEEK, 0);
    const startedAt2 = await currentTick();
    const lockInfo2 = await xAGF.balanceOfUnderlyingAndExpiry(root.address);
    const total123 = await xAGF.totalSupply();

    await mineToTicks(lockInfo.availableSince + WEEK); // longer wait should not change the result

    await rewardController.connect(user1).claimReward();
    await rewardController.connect(user2).claimReward();
    await rewardController.connect(root).claimReward();

    const reward1 = await AGF.balanceOf(user1.address);
    const reward2 = await AGF.balanceOf(user2.address);
    const reward3 = await AGF.balanceOf(root.address);

    expect(reward2.toNumber()).approximately(reward1.toNumber() * 2, 5); // user2 gets 2x more including a portion of the excess of 10000

    const fullRun = lockInfo.availableSince - startedAt;
    const rewards = reward1.add(reward2).add(reward3);
    expect(rewards.toNumber()).approximately(fullRun + 10000, 2); // rate = 1, so all rewards are 1*time + 10000 (excess)

    const balancePortion = (total123.toNumber() - total12.toNumber()) / total123.toNumber();
    // 3rd user has missed the excess, and receives only time * balance portion
    expect(reward3.toNumber()).approximately(
      (lockInfo2.availableSince - startedAt2) * balancePortion,
      10
    );
  });
});
