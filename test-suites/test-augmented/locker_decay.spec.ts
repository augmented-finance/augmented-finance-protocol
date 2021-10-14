import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import { getMockAgfToken, getMockRewardBooster, getMockDecayingTokenLocker } from '../../helpers/contracts-getters';

import { MockAgfToken, RewardBooster, DecayingTokenLocker } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { currentTick, mineToTicks, mineTicks, revertSnapshot, takeSnapshot, alignTicks } from './utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { BigNumber } from 'ethers';
import { MAX_LOCKER_PERIOD, RAY, DAY, WEEK, HALF_RAY, PERC_100 } from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';

chai.use(solidity);
const { expect } = chai;

describe('Token decaying locker suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rewardController: RewardBooster;
  let AGF: MockAgfToken;
  let xAGF: DecayingTokenLocker;
  let blkBeforeDeploy;
  const defaultStkAmount = 1e9;
  const MIN_PERIOD = WEEK;
  const MAX_PERIOD = MAX_LOCKER_PERIOD;

  before(async () => {
    [root, user1, user2] = await (<any>rawBRE).ethers.getSigners();
    await rawBRE.run('augmented:test-local-decay', CFG);
    rewardController = await getMockRewardBooster();

    AGF = await getMockAgfToken();
    xAGF = await getMockDecayingTokenLocker();

    await AGF.connect(root).mintReward(user1.address, defaultStkAmount, false);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);

    await AGF.connect(root).mintReward(user2.address, defaultStkAmount, false);
    await AGF.connect(user2).approve(xAGF.address, defaultStkAmount);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('reward for linearly decaying balance', async () => {
    const start = 100;
    const width = 10000;
    const step = width / 10;
    const divisor = BigNumber.from(10).pow(18);

    expect(await xAGF.calcDecayForReward(start, start + width, start, start)).eq(0);
    expect(await xAGF.calcDecayForReward(start, start + width, start, start + width)).eq(HALF_RAY);

    let totalDecay = 0.0;
    for (let i = 0; i < width; i += step) {
      let stepDecay = (await xAGF.calcDecayForReward(start, start + width, start + i, start + i + step))
        .div(divisor)
        .toNumber();
      stepDecay = (stepDecay * step) / 1.0e9;
      totalDecay += stepDecay;

      let fullDecay = (await xAGF.calcDecayForReward(start, start + width, start, start + i + step))
        .div(divisor)
        .toNumber();
      fullDecay = (fullDecay * (i + step)) / 1.0e9;
      expect(totalDecay).eq(fullDecay);
    }
  });

  it('reward compensation of decay recycling', async () => {
    const start = 100;
    const width = 10000;
    const step = width / 10;
    const divisor = BigNumber.from(10).pow(18);

    expect(await xAGF.calcDecayTimeCompensation(start, start + width, start, start)).eq(0);
    expect(await xAGF.calcDecayTimeCompensation(start, start + width, start, start + width)).eq(RAY);

    let totalSmallSteps = 0.0;
    let lastFullStep = 0.0;
    for (let i = 0; i < width; i += step) {
      let stepSmall = (await xAGF.calcDecayTimeCompensation(start, start + width, start + i, start + i + step))
        .div(divisor)
        .toNumber();
      totalSmallSteps += stepSmall;

      const fullStep = (await xAGF.calcDecayTimeCompensation(start, start + width, start, start + i + step))
        .div(divisor)
        .toNumber();

      expect(fullStep).gt(lastFullStep); // bigger step gives more
      lastFullStep = fullStep;

      if (i == 0) {
        expect(totalSmallSteps).lte(fullStep);
      } else {
        expect(totalSmallSteps).lt(fullStep); // bigger step is better than a seris of small ones
      }
    }
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

  it('user sees balance decay and redeems after', async () => {
    const defaultPeriod = WEEK * 3;
    const lockTick = await currentTick();

    expect(await xAGF.totalSupply()).eq(0);
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);

    const initialBalance = (await xAGF.balanceOf(user1.address)).toNumber();
    expect(await xAGF.totalSupply()).eq(initialBalance);

    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineTicks(DAY);
    expect(await xAGF.totalSupply()).eq(initialBalance);
    const dayPassBalance = await xAGF.balanceOf(user1.address);
    expect(dayPassBalance).lt(initialBalance);

    await mineTicks(WEEK);
    expect(await xAGF.totalSupply()).eq(initialBalance);
    const weekPassBalance = await xAGF.balanceOf(user1.address);
    expect(weekPassBalance).lt(dayPassBalance);

    await mineToTicks(lockInfo.availableSince - 5);

    expect(await xAGF.balanceOf(user1.address)).lt(weekPassBalance);
    expect(await xAGF.balanceOf(user1.address)).gt(0);
    expect(await xAGF.totalSupply()).eq(initialBalance);

    await mineToTicks(lockInfo.availableSince);

    await xAGF.connect(user1).redeem(user1.address);

    expect(await xAGF.totalSupply()).eq(0);
    expect(await xAGF.balanceOf(user1.address)).eq(0);
  });

  it('user1 claims daily, user2 claims once', async () => {
    const defaultPeriod = WEEK * 4;
    const rateBase = (await xAGF.getRate()).toNumber();

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    await xAGF.connect(user2).lock(defaultStkAmount, defaultPeriod, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    let lastBalance = BigNumber.from(0);
    let lastIncrement = BigNumber.from(0);

    for (let step = DAY, tick = step; tick < defaultPeriod; tick += step) {
      await mineToTicks(tick + lockTick);

      // this call is unnecessary, but it helps to get a proper average gas cost
      await xAGF.update(0);

      const expectedIncrement = await rewardController.claimableReward(user2.address);
      await rewardController.connect(user2).claimReward();
      const newBalance = await AGF.balanceOf(user2.address);
      const newIncrement = newBalance.sub(lastBalance);

      // console.log(tick, newBalance.toString(), newIncrement.toString()); //, expectedLongBalance.claimable.toString());

      const expectedLongClaim = await rewardController.claimableReward(user1.address);
      expect(newBalance.toNumber()).lte(expectedLongClaim.claimable.toNumber());

      expect(newIncrement.toNumber()).approximately(expectedIncrement.claimable.toNumber(), rateBase); // +/- 1 tick rate
      if (tick > step) {
        if (newIncrement.eq(0) && tick > defaultPeriod / 2) {
          break;
        }
        // console.log(' ', lastIncrement.toNumber(), '\n ', newIncrement.toNumber(), newIncrement.lt(lastIncrement));
        expect(newIncrement).lt(lastIncrement);
      }
      lastBalance = newBalance;
      lastIncrement = newIncrement;
    }

    await mineToTicks(lockInfo.availableSince);

    const expectedLongClaim = await rewardController.claimableReward(user1.address);
    await rewardController.connect(user1).claimReward();
    await rewardController.connect(user2).claimReward();

    const longClaim = await AGF.balanceOf(user1.address);
    expect(longClaim.toNumber()).approximately(expectedLongClaim.claimable.toNumber(), rateBase); // +/- 1 tick rate

    // micro-claims shouldn't give benefits
    const shortClaims = await AGF.balanceOf(user2.address);
    expect(longClaim).gte(shortClaims);

    // console.log(longClaim.toString(), shortClaims.toString());
  });

  it('user1 claims daily, user2 claims once, user3 stays large & long', async () => {
    await AGF.connect(root).mintReward(root.address, defaultStkAmount * 10, false);
    await AGF.connect(root).approve(xAGF.address, defaultStkAmount * 10);

    const defaultPeriod = WEEK * 4;
    const rateBase = (await xAGF.getRate()).toNumber();

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    await xAGF.connect(user2).lock(defaultStkAmount, defaultPeriod, 0);
    await xAGF.connect(root).lock(defaultStkAmount * 10, defaultPeriod * 52, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    let lastBalance = BigNumber.from(0);
    let lastIncrement = BigNumber.from(0);

    for (let step = DAY, tick = step; tick < defaultPeriod; tick += step) {
      await mineToTicks(tick + lockTick);

      // this call is unnecessary, but it helps to get a proper average gas cost
      await xAGF.update(0);

      const expectedIncrement = await rewardController.claimableReward(user2.address);
      await rewardController.connect(user2).claimReward();
      const newBalance = await AGF.balanceOf(user2.address);
      const newIncrement = newBalance.sub(lastBalance);

      // console.log(tick, newBalance.toString(), newIncrement.toString()); //, expectedLongBalance.claimable.toString());

      const expectedLongClaim = await rewardController.claimableReward(user1.address);
      expect(newBalance.toNumber()).lte(expectedLongClaim.claimable.toNumber());

      expect(newIncrement.toNumber()).approximately(expectedIncrement.claimable.toNumber(), rateBase / 10); // +/- 10% of tick rate
      if (tick > step) {
        if (newIncrement.eq(0) && tick > defaultPeriod / 2) {
          break;
        }
        expect(newIncrement).lt(lastIncrement);
      }
      lastBalance = newBalance;
      lastIncrement = newIncrement;
    }

    await mineToTicks(lockInfo.availableSince);

    await xAGF.update(0, { gasLimit: 5000000 });

    const expectedLongClaim = await rewardController.claimableReward(user1.address);
    await rewardController.connect(user1).claimReward();
    await rewardController.connect(user2).claimReward();

    const longClaim = await AGF.balanceOf(user1.address);
    expect(longClaim.toNumber()).approximately(expectedLongClaim.claimable.toNumber(), rateBase / 10); // +/- 10% of tick rate

    // micro-claims shouldn't give benefits
    const shortClaims = await AGF.balanceOf(user2.address);
    expect(longClaim).gte(shortClaims);
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

  it('user1 creates then adds to a lock', async () => {
    await alignTicks(WEEK);
    const rateBase = (await xAGF.getRate()).toNumber();

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
    await rewardController.connect(user1).claimReward();

    const balance = await AGF.balanceOf(user1.address);
    expect(reward2.claimable.toNumber()).approximately(balance.toNumber(), rateBase);
  });

  it('user1 creates then extends a lock', async () => {
    await alignTicks(WEEK);
    const rateBase = (await xAGF.getRate()).toNumber();

    const startedAt = await currentTick();
    await xAGF.connect(user1).lock(defaultStkAmount, WEEK * 4, 0);
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    const xBalance = await xAGF.balanceOf(user1.address);

    expect(lockInfo.underlying).eq(defaultStkAmount);
    expect(lockInfo.availableSince).eq(startedAt + WEEK * 4);

    await mineTicks(WEEK);
    const reward1 = await rewardController.claimableReward(user1.address);
    expect(reward1.claimable).gt(0);

    const xBalance1 = await xAGF.balanceOf(user1.address);
    await xAGF.connect(user1).lockExtend(WEEK * 2); // no effect
    expect((await xAGF.balanceOf(user1.address)).toNumber()).approximately(xBalance1.toNumber(), 100);

    let lockInfo2 = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo2.underlying).eq(defaultStkAmount);
    expect(lockInfo2.availableSince).eq(lockInfo.availableSince);

    await xAGF.connect(user1).lockExtend(WEEK * 7);

    lockInfo2 = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);
    expect(lockInfo2.underlying).eq(defaultStkAmount);
    expect(lockInfo2.availableSince).eq(startedAt + WEEK * 8);

    const xBalance2 = await xAGF.balanceOf(user1.address);
    expect(xBalance2.mul(8).div(7).toNumber()).approximately(xBalance.mul(2).toNumber(), 100);

    await mineToTicks(lockInfo2.availableSince);

    // make sure that claimableReward will use the recent state
    await xAGF.update(0);
    const reward2 = await rewardController.claimableReward(user1.address);
    await rewardController.connect(user1).claimReward();

    const balance = await AGF.balanceOf(user1.address);
    expect(reward2.claimable.toNumber()).approximately(balance.toNumber(), rateBase);

    expect(reward2.claimable.sub(reward1.claimable)).gt(reward1.claimable);
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

  it('user1 gets no boost without work', async () => {
    await rewardController.setBoostPool(xAGF.address);

    const defaultPeriod = WEEK * 4;
    const rateBase = await xAGF.getRate();
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);

    let reward = await rewardController.claimableReward(user1.address);
    expect(reward.claimable).eq(0);
    expect(reward.extra).eq(0);
  });

  it.skip('user1 gets min boost without work, ignore excess', async () => {
    await rewardController.setBoostPool(xAGF.address);

    const defaultPeriod = WEEK * 4;
    const rateBase = await xAGF.getRate();
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);
    const expectedBalance = rateBase.mul(lockInfo.availableSince - lockTick);

    {
      await rewardController.setMinBoost(PERC_100 / 10);
      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(expectedBalance.div(10).sub(reward.claimable)).lte(1);
    }

    {
      await rewardController.setMinBoost(PERC_100);

      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(expectedBalance.sub(reward.claimable)).lte(1);
    }
  });

  it('user1 claims 100% min boost without work, reuse 0% excess', async () => {
    await rewardController.setBoostPool(xAGF.address);
    await rewardController.setUpdateBoostPoolRate(true);
    await rewardController.setBoostExcessTarget(xAGF.address, false);

    const defaultPeriod = WEEK * 4;
    const rateBase = await xAGF.getRate();
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);
    const expectedBalance = rateBase.mul(lockInfo.availableSince - lockTick);

    await rewardController.setMinBoost(PERC_100);

    {
      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(expectedBalance.sub(reward.claimable)).lte(1);
    }

    await rewardController.connect(user1).claimReward();

    {
      const balance = await AGF.balanceOf(user1.address);
      expect(expectedBalance.sub(balance)).lte(rateBase);
    }

    // There will be no reward generated direcly because of 0 rate
    // But recycled excess can also provide some rewards
    await rewardController.updateBaseline(0);

    await xAGF.connect(user1).redeem(user1.address);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod + WEEK * 2, 0);
    await mineTicks(defaultPeriod + WEEK * 3); // a bit more, just to make sure

    {
      // nothing was recycled
      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(reward.claimable).eq(0);
    }

    await rewardController.connect(user1).claimReward();
    {
      const balance = await AGF.balanceOf(user1.address);
      expect(expectedBalance.sub(balance)).lte(rateBase);
    }
  });

  it('user1 claims 10% min boost without work, reuse 90% excess', async () => {
    await alignTicks(WEEK);

    await rewardController.setBoostPool(xAGF.address);
    await rewardController.setUpdateBoostPoolRate(true);
    await rewardController.setBoostExcessTarget(xAGF.address, false);

    const defaultPeriod = WEEK * 4;
    const rateBase = await xAGF.getRate();
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod, 0);
    const lockTick = await currentTick();
    const lockInfo = await xAGF.balanceOfUnderlyingAndExpiry(user1.address);

    await mineToTicks(lockInfo.availableSince);

    const wholeExpectedBalance = rateBase.mul(lockInfo.availableSince - lockTick);
    const expectedBalance = wholeExpectedBalance.div(10);
    const recycledBalance = wholeExpectedBalance.sub(expectedBalance);

    await rewardController.setMinBoost(PERC_100 / 10);
    {
      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(expectedBalance.sub(reward.claimable)).lte(1);
    }

    await rewardController.connect(user1).claimReward();
    const claimTick = await currentTick();

    const balance = await AGF.balanceOf(user1.address);
    expect(expectedBalance.sub(balance)).lte(rateBase);

    // There will be no reward generated direcly because of 0 rate
    // But recycled excess can also provide some rewards
    await rewardController.updateBaseline(0);
    // To collect all recycled
    await rewardController.setMinBoost(PERC_100);

    await xAGF.connect(user1).redeem(user1.address);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod * 2, 0);

    // Some of recycled rewards are lost during operations / ticks made in-between
    const possibleLoss = rateBase.mul((await currentTick()) - claimTick);

    await mineTicks(defaultPeriod * 3); // a bit more, just to make sure to callect the most of recycled excess

    // this is to make sure that claimableReward calculations are ok
    // as excess calc is tricky
    await xAGF.update(0);
    {
      const reward = await rewardController.claimableReward(user1.address);
      expect(reward.extra).eq(0);
      expect(recycledBalance.sub(reward.claimable)).lte(possibleLoss);
    }

    await rewardController.connect(user1).claimReward();
    {
      const balance = await AGF.balanceOf(user1.address);
      expect(wholeExpectedBalance.sub(balance)).lte(possibleLoss);
    }
  });

  it('should be able to set zero rate with a boost pool attached', async () => {
    await rewardController.setBoostPool(xAGF.address);

    await expect(rewardController.updateBaseline(0)).to.be.revertedWith(ProtocolErrors.RW_BASELINE_EXCEEDED);
    await rewardController.setUpdateBoostPoolRate(true);

    await rewardController.updateBaseline(0);
    await rewardController.updateBaseline(1e9);
  });
});
