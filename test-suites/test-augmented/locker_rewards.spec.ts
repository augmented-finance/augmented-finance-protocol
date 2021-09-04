import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';
import { AccessFlags } from '../../helpers/access-flags';

import {
  getMarketAccessController,
  getMockAgfToken,
  getMockRewardFreezer,
  getMockTokenLocker,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, RewardedTokenLocker } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { currentTick, mineToTicks, mineTicks, revertSnapshot, takeSnapshot, alignTicks } from './utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { BigNumber } from 'ethers';
import { MAX_LOCKER_PERIOD, RAY, DAY, WEEK, MAX_LOCKER_WEEKS } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Token locker suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rewardController: RewardFreezer;
  let AGF: MockAgfToken;
  let xAGF: RewardedTokenLocker;
  let blkBeforeDeploy;
  const defaultStkAmount = 1e9;
  const MIN_PERIOD = WEEK;
  const MAX_PERIOD = MAX_LOCKER_PERIOD;

  before(async () => {
    [root, user1, user2] = await (<any>rawBRE).ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rewardController = await getMockRewardFreezer();
    rewardController.setFreezePercentage(0);

    AGF = await getMockAgfToken();
    xAGF = await getMockTokenLocker();

    await AGF.connect(root).mintReward(user1.address, defaultStkAmount, false);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);

    await AGF.connect(root).mintReward(user2.address, defaultStkAmount * 2, false);
    await AGF.connect(user2).approve(xAGF.address, defaultStkAmount * 2);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
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

    const expectedBalanceMin = BigNumber.from(defaultStkAmount).mul(MIN_PERIOD).div(MAX_PERIOD).toNumber();
    const actualBalance = (await xAGF.balanceOf(user1.address)).toNumber();
    expect(actualBalance).within(expectedBalanceMin / 2, (expectedBalanceMin * 3) / 2); // depends on current timestamp
    expect(await xAGF.totalSupply()).eq(actualBalance);

    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo.underlying).eq(defaultStkAmount);

    expect(lockInfo.availableSince).within(lockTick + defaultPeriod / 2, lockTick + (defaultPeriod * 3) / 2);

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

    await expect(xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount)).to.be.revertedWith('NOTHING_IS_LOCKED');

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

    expect(await xAGF.totalSupply()).lte(prevSupply.add(1));

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

    await expect(xAGF.connect(user2).lockAdd(user1.address, defaultStkAmount)).to.be.revertedWith('NOTHING_IS_LOCKED');

    await expect(xAGF.connect(user2).lockExtend(WEEK * 4)).to.be.revertedWith('NOTHING_IS_LOCKED');

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
    const rateBase = (await xAGF.getRate()).toNumber();

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

    expect(rewards.toNumber()).approximately((lockInfo.availableSince - startedAt) * rateBase, 2 * rateBase);
  });

  it('2 users share excess, 3rd user misses it', async () => {
    await AGF.connect(root).mintReward(root.address, defaultStkAmount, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount);

    const rateBase = (await xAGF.getRate()).toNumber();

    await xAGF.connect(user1).lock(defaultStkAmount, 6 * WEEK, 0);
    const startedAt = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await xAGF.connect(user2).lock(defaultStkAmount * 2, 6 * WEEK, 0);
    const total12 = await xAGF.totalSupply();

    expect(await xAGF.getRate()).eq(rateBase);

    const ac = await getMarketAccessController(await rewardController.getAccessController());
    ac.grantAnyRoles(root.address, AccessFlags.REWARD_CONTROLLER);

    const excessAmount = WEEK * 1000;
    await xAGF.connect(root).receiveBoostExcess(excessAmount, 0); // excessAmount will be distributed over ~2 weeks

    expect(await xAGF.getRate()).eq(rateBase);

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

    // user2 gets 2x more including a portion of the excess of 10000
    expect(reward2.toNumber()).approximately(reward1.toNumber() * 2, 5 * rateBase);

    const fullRun = (lockInfo.availableSince - startedAt) * rateBase;
    const rewards = reward1.add(reward2).add(reward3);

    // rate = 1, so all rewards are 1*time + excessAmount
    // but some portion of excessAmount can be withheld due to rounding by WEEK intervals
    expect(rewards.toNumber()).approximately(fullRun + excessAmount, WEEK + 2 * rateBase);

    const balancePortion = (total123.toNumber() - total12.toNumber()) / total123.toNumber();
    // 3rd user has missed the excess, and receives only time * balance portion
    expect(reward3.toNumber()).approximately(
      (lockInfo2.availableSince - startedAt2) * balancePortion * rateBase,
      10 * rateBase
    );
  });

  it('3 users scattered over 4 years', async () => {
    const defaultPeriod = WEEK * 52;

    await AGF.connect(root).mintReward(root.address, defaultStkAmount, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount);

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod + 3 * defaultPeriod, 0);
    await xAGF.connect(user2).lock(defaultStkAmount, defaultPeriod + 1 * defaultPeriod, 0);
    await xAGF.connect(root).lock(defaultStkAmount, defaultPeriod + 2 * defaultPeriod, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);

    await xAGF.connect(user1).update(0, { gasLimit: 500000 });
  });

  it('user gets no reward for inter-lock gap', async () => {
    await alignTicks(WEEK);
    const rateBase = (await xAGF.getRate()).toNumber();

    await xAGF.connect(user1).lock(defaultStkAmount / 2, WEEK, 0);
    let lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);
    const expectedReward = (await rewardController.connect(user1).claimableReward(user1.address)).claimable;
    await mineTicks(WEEK * 2);

    await xAGF.connect(user1).redeem(user2.address);
    const expectedReward1 = (await rewardController.connect(user1).claimableReward(user1.address)).claimable;
    expect(expectedReward1).eq(expectedReward);

    await xAGF.connect(user1).lock(defaultStkAmount / 2, WEEK, 0);

    lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo.underlying).eq(defaultStkAmount / 2);

    await mineToTicks(lockInfo.availableSince);

    const expectedReward2 = (await rewardController.connect(user1).claimableReward(user1.address)).claimable;

    await rewardController.connect(user1).claimReward();
    const reward1 = await AGF.balanceOf(user1.address);
    console.log(reward1.toString(), expectedReward.toString(), expectedReward2.toString());

    expect(reward1).eq(expectedReward2);
    expect(expectedReward.toNumber()).approximately(expectedReward2.sub(expectedReward).toNumber(), 2 * rateBase);
  });

  it('user gets no reward for inter-lock gap without redeem', async () => {
    await alignTicks(WEEK);
    const rateBase = (await xAGF.getRate()).toNumber();

    const halfAmount = defaultStkAmount / 2;
    await xAGF.connect(user1).lock(halfAmount, WEEK, 0);
    let lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);
    const expectedReward = (await rewardController.connect(user1).claimableReward(user1.address)).claimable;
    await mineTicks(WEEK * 2);

    await xAGF.connect(user1).lock(halfAmount, WEEK, 0);

    lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo.underlying).eq(halfAmount * 2);
    await mineToTicks(lockInfo.availableSince);

    const expectedReward2 = (await rewardController.connect(user1).claimableReward(user1.address)).claimable;

    await rewardController.connect(user1).claimReward();
    const reward1 = await AGF.balanceOf(user1.address);

    expect(reward1).eq(expectedReward2);
    expect(expectedReward.toNumber()).approximately(expectedReward2.sub(expectedReward).toNumber(), 2 * rateBase);
  });

  it('3 users spread over 4 years, apply partial update', async () => {
    await AGF.connect(root).mintReward(root.address, defaultStkAmount, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount);

    await xAGF.connect(user1).lock(defaultStkAmount, WEEK, 0);
    await xAGF.connect(user2).lock(defaultStkAmount, MAX_LOCKER_PERIOD, 0);
    await xAGF.connect(root).lock(defaultStkAmount, MAX_LOCKER_PERIOD + 6 * WEEK, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user2.address);

    await mineToTicks(lockInfo.availableSince + WEEK);

    const gasLimit = 275000;
    await xAGF
      .connect(user1)
      .update(0, { gasLimit: gasLimit })
      .then(() => expect(() => {}).to.throw('out of gas'))
      .catch((reason) => {
        expect(reason.message).contain('out of gas');
      });

    // do a partial update
    await xAGF.connect(user1).update(104, { gasLimit: gasLimit });

    // overshoot by update
    await xAGF.connect(user1).update(MAX_LOCKER_WEEKS - 104 + 3, { gasLimit: gasLimit });

    // make sure that remaining locks are valid and further updates are correct
    const lockInfo2 = await xAGF.balanceOfUnderlyingAndExpiry(root.address);
    expect(lockInfo2.availableSince).gt(lockInfo.availableSince);
    expect(await xAGF.totalSupply()).gt(0);
    expect(await xAGF.totalSupply()).eq(await xAGF.balanceOf(root.address));

    await mineToTicks(lockInfo2.availableSince + MAX_LOCKER_PERIOD);
    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.totalSupply()).eq(await xAGF.balanceOf(root.address));

    await xAGF.connect(user1).update(1e12, { gasLimit: gasLimit });

    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.totalSupply()).eq(await xAGF.balanceOf(root.address));

    await xAGF.connect(user1).update(0, { gasLimit: gasLimit });

    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.totalSupply()).eq(await xAGF.balanceOf(root.address));
  });

  it('user1 creates then adds to a lock', async () => {
    await alignTicks(WEEK);
    const rateBase = (await xAGF.getRate()).toNumber();

    const startedAt = await currentTick();
    await xAGF.connect(user1).lock(defaultStkAmount - 1, WEEK * 4, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineTicks(WEEK * 2);
    const reward1 = await rewardController.claimableReward(user1.address);
    expect(reward1.claimable).gt(0);

    const xBalance = await xAGF.balanceOf(user1.address);
    await xAGF.connect(user1).lock(1, 0, 0);
    expect((await xAGF.balanceOf(user1.address)).toNumber()).approximately(xBalance.toNumber(), 100);

    const lockInfo2 = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    expect(lockInfo2.underlying).eq(defaultStkAmount);
    expect(lockInfo2.availableSince).eq(lockInfo.availableSince);

    await mineToTicks(lockInfo.availableSince);

    const reward2 = await rewardController.claimableReward(user1.address);
    const passed = (await currentTick()) - startedAt;

    await rewardController.connect(user1).claimReward();

    const balance = await AGF.balanceOf(user1.address);
    expect(reward2.claimable.toNumber()).approximately(balance.toNumber(), rateBase);
    expect(balance.toNumber()).approximately(rateBase * passed, 5 * rateBase);

    expect(reward2.claimable.sub(reward1.claimable).toNumber()).approximately(
      reward1.claimable.toNumber(),
      10 * rateBase
    );
  });

  it('no more rewards after expiry', async () => {
    await xAGF.connect(user1).lock(defaultStkAmount, WEEK * 4, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    const rateBase = (await xAGF.getRate()).toNumber();

    await mineToTicks(lockInfo.availableSince);

    const reward = await rewardController.claimableReward(user1.address);

    await mineTicks(WEEK);

    const reward1 = await rewardController.claimableReward(user1.address);
    expect(reward1.claimable).eq(reward.claimable);

    await rewardController.connect(user1).claimReward();

    const balance = await AGF.balanceOf(user1.address);
    expect(reward.claimable.toNumber()).approximately(balance.toNumber(), rateBase);

    await mineTicks(WEEK);

    const reward2 = await rewardController.claimableReward(user1.address);
    expect(reward2.claimable).eq(0);

    await rewardController.connect(user1).claimReward();

    expect(await AGF.balanceOf(user1.address)).eq(balance);
  });
});
