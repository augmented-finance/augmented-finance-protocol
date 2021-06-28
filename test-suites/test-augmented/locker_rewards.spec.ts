import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import { getMockAgfToken, getRewardFreezer, getXAgfToken } from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, ForwardingRewardPool, XAGFTokenV1 } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { waitForTx } from '../../helpers/misc-utils';
import { currentTick, mineToTicks, mineTicks, revertSnapshot, takeSnapshot } from './utils';
import { calcTeamRewardForMember } from './helpers/utils/calculations_augmented';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { BigNumber } from 'ethers';

chai.use(solidity);
const { expect } = chai;

describe('Token locker suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  //  let frp: ForwardingRewardPool;
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
    //    frp = await getForwardingRewardPool();
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
    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod);

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

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod);
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

    await xAGF.connect(user1).lock(defaultStkAmount, defaultPeriod * 2);
    const balance1 = await xAGF.balanceOf(user1.address);
    expect(await xAGF.totalSupply()).eq(balance1);

    await xAGF.connect(user2).lock(defaultStkAmount, defaultPeriod);
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
});
