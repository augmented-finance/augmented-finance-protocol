import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getForwardingRewardPoolDecay,
  getRewardBooster,
  getDecayingTokenLocker,
} from '../../helpers/contracts-getters';

import {
  MockAgfToken,
  RewardFreezer,
  ForwardingRewardPool,
  XAGFTokenV1,
  RewardedTokenLocker,
  RewardBooster,
  DecayingTokenLocker,
} from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { waitForTx } from '../../helpers/misc-utils';
import { currentTick, mineToTicks, mineTicks, revertSnapshot, takeSnapshot } from './utils';
import { calcTeamRewardForMember } from './helpers/utils/calculations_augmented';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { BigNumber } from 'ethers';
import {
  MAX_LOCKER_PERIOD,
  RAY,
  RAY_100,
  RAY_10000,
  RAY_PER_WEEK,
  DAY,
  WEEK,
  HALF_RAY,
} from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Token decaying locker suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let frp: ForwardingRewardPool;
  let rewardController: RewardBooster;
  let AGF: MockAgfToken;
  let xAGF: DecayingTokenLocker;
  let blkBeforeDeploy;
  const defaultStkAmount = 1e9;
  const MIN_PERIOD = WEEK;
  const MAX_PERIOD = MAX_LOCKER_PERIOD;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local-decay', CFG);
    rewardController = await getRewardBooster();

    frp = await getForwardingRewardPoolDecay();
    AGF = await getMockAgfToken();
    xAGF = await getDecayingTokenLocker();

    await AGF.connect(root).mintReward(user1.address, defaultStkAmount, false);
    await AGF.connect(user1).approve(xAGF.address, defaultStkAmount);

    await AGF.connect(root).mintReward(user2.address, defaultStkAmount, false);
    await AGF.connect(user2).approve(xAGF.address, defaultStkAmount);
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('reward linear decay', async () => {
    const start = 100;
    const width = 10000;
    const step = width / 10;
    const divisor = BigNumber.from(10).pow(18);

    expect(await xAGF.calcDecayForReward(start, start + width, start, start)).eq(0);
    expect(await xAGF.calcDecayForReward(start, start + width, start, start + width)).eq(HALF_RAY);

    let totalDecay = 0.0;
    for (let i = 0; i < width; i += step) {
      let stepDecay = (
        await xAGF.calcDecayForReward(start, start + width, start + i, start + i + step)
      )
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

  it('user sees gradual decay', async () => {
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
});
