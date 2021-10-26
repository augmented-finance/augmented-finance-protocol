import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import {
  getAGTokenByName,
  getMockAgfToken,
  getMockStakedAgfToken,
  getMockRewardBooster,
  getTokenWeightedRewardPoolAGBoosted,
  getTokenWeightedRewardPoolAGFBooster, getTokenWeightedRewardPoolAGUSDCBoosted,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CFG, stakingCooldownTicks } from '../../tasks/migrations/defaultTestDeployConfig';
import { currentTick, mineTicks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import {
  DepositToken,
  MockAgfToken,
  MockStakedAgfToken,
  RewardBooster,
  TokenWeightedRewardPool,
} from '../../types';
import { applyDepositPlanAndClaimAll, TestInfo } from '../test_utils';
import { min } from 'underscore';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Staking with boosting', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let slasher: SignerWithAddress;
  let excessReceiverUser: SignerWithAddress;
  let rb: RewardBooster;
  let AGF: MockAgfToken;
  let xAGF: MockStakedAgfToken;
  let agDAI: DepositToken;
  let agUSDC: DepositToken;
  let rpAGF: TokenWeightedRewardPool;
  let rpAGDAI: TokenWeightedRewardPool;
  let rpUSDC: TokenWeightedRewardPool;
  let blkBeforeDeploy;
  const defaultStkAmount = 100;

  before(async () => {
    [root, user1, user2, slasher] = await (<any>rawBRE).ethers.getSigners();
    await rawBRE.run('augmented:test-local-staking', CFG);
    rb = await getMockRewardBooster();

    agDAI = await getAGTokenByName('agDAI');
    agUSDC = await getAGTokenByName('agUSDC');
    rpAGDAI = await getTokenWeightedRewardPoolAGBoosted();
    rpUSDC = await getTokenWeightedRewardPoolAGUSDCBoosted();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGFBooster();
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('check boost factor and mask for boost pool', async () => {
    const bp1 = await rb.getBoostPool();
    expect(bp1.pool).eq(rpAGF.address);
    expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));
    expect(await rb.getBoostFactor(rpAGF.address)).eq(0);
    await expect(rb.setBoostFactor(rpAGF.address, 3)).to.be.revertedWith('factor for the boost pool');

    await rb.setBoostPool(ZERO_ADDRESS);
    const bp2 = await rb.getBoostPool();
    expect(bp2.pool).eq(ZERO_ADDRESS);
    expect(bp2.mask).eq(0);

    expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));

    await rb.setBoostFactor(rpAGF.address, 3);
    expect(await rb.getBoostFactor(rpAGF.address)).eq(3);

    expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));

    await rb.setBoostPool(rpAGF.address);
    expect((await rb.getBoostPool()).pool).eq(rpAGF.address);
    expect(await rb.getBoostFactor(rpAGF.address)).eq(0);
  });

  it('can remove boost pool', async () => {
    {
      const pools = await rb.getPools();
      expect(0).eq(pools.ignoreMask);
      expect([rpAGDAI.address, rpUSDC.address, rpAGF.address]).eql(pools[0]);
    }

    const bp1 = await rb.getBoostPool();
    expect(bp1.pool).eq(rpAGF.address);
    expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));

    await rb.removeRewardPool(rpAGF.address);

    const bp2 = await rb.getBoostPool();
    expect(bp2.pool).eq(ZERO_ADDRESS);
    expect(bp2.mask).eq(0);

    expect(0).eq(await rb.getPoolMask(rpAGF.address));

    {
      const pools = await rb.getPools();
      expect(4).eq(pools.ignoreMask);
      expect([rpAGDAI.address, rpUSDC.address, ZERO_ADDRESS]).eql(pools[0]);
    }
  });

  it('can remove then add a pool, keep the boost pool', async () => {
    {
      const pools = await rb.getPools();
      expect(0).eq(pools.ignoreMask);
      expect([rpAGDAI.address, rpUSDC.address, rpAGF.address]).eql(pools[0]);
    }

    {
      const bp1 = await rb.getBoostPool();
      expect(bp1.pool).eq(rpAGF.address);
      expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));
    }

    await rb.removeRewardPool(rpUSDC.address);

    {
      const bp1 = await rb.getBoostPool();
      expect(bp1.pool).eq(rpAGF.address);
      expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));
    }

    expect(0).eq(await rb.getPoolMask(rpUSDC.address));

    {
      const pools = await rb.getPools();
      expect(2).eq(pools.ignoreMask);
      expect([rpAGDAI.address, ZERO_ADDRESS, rpAGF.address]).eql(pools[0]);
    }

    await rb.addRewardPool(rpUSDC.address);

    {
      const bp1 = await rb.getBoostPool();
      expect(bp1.pool).eq(rpAGF.address);
      expect(bp1.mask).eq(await rb.getPoolMask(rpAGF.address));
    }

    expect(8).eq(await rb.getPoolMask(rpUSDC.address));

    {
      const pools = await rb.getPools();
      expect(2).eq(pools.ignoreMask);
      expect([rpAGDAI.address, ZERO_ADDRESS, rpAGF.address, rpUSDC.address]).eql(pools[0]);
    }

    expect(0).eq(await rb.claimablePools(user1.address));
    await rb.setClaimablePoolsFor([user1.address], 65535);
    expect(9).eq(await rb.claimablePools(user1.address)); // the removed pool and the boost pools are excluded

    await rb.connect(user1).claimReward(); // sanity check
    expect(0).eq(await rb.claimablePools(user1.address)); // there was nothing to claim from any pool
    await rb.claimRewardTo(user1.address, MAX_UINT_AMOUNT); // sanity check
  });

  it('no boost or rewards', async () => {
    await mineTicks(stakingCooldownTicks);
    await rb.connect(user1).claimReward();
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
  });

  it('no boost without work in pools', async () => {
    await rpAGF.handleBalanceUpdate(
      xAGF.address,
      user1.address,
      0,
      defaultStkAmount,
      defaultStkAmount
    );
    const rewardingBlocks = 19;
    await mineTicks(rewardingBlocks);
    await rb.connect(user1).claimReward();
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
  });

  it('agDAI boost factor set to zero, get rewards', async () => {
    await rb.connect(root).setBoostFactor(rpAGDAI.address, 0);
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    // basic work of the deposit
    const basicAmount = ti.TotalRewardTicks;

    await applyDepositPlanAndClaimAll(ti, rb);
    expect(await AGF.balanceOf(user1.address)).to.eq(basicAmount);
  });

  it('multiple deposits for work', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
        {
          Signer: user1,
          Pool: rpUSDC,
          TokenAddress: agUSDC.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    const boostAmount = ti.TotalRewardTicks + 2; 
    const basicAmount1 = ti.TotalRewardTicks + 1;
    const basicAmount2 = ti.TotalRewardTicks;

    await applyDepositPlanAndClaimAll(ti, rb);
    expect(await AGF.balanceOf(user1.address)).to.eq(
      basicAmount1 + basicAmount2 + + min([boostAmount, basicAmount1 + basicAmount2])
    );
  });

  it('can stake AGF to xAGF, deposit agDAI for 20 blocks, receive boost reward', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    const boostAmount = ti.TotalRewardTicks + 1;
    const basicAmount = ti.TotalRewardTicks;

    await applyDepositPlanAndClaimAll(ti, rb);
    expect(await AGF.balanceOf(user1.address)).to.eq(basicAmount + min([boostAmount, basicAmount]));
  });

  it('deposit agDAI for 10 blocks, redeem, wait 10 blocks and still get full reward', async () => {
    const ti = {
      TotalRewardTicks: 10,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;
    const boostAmount = ti.TotalRewardTicks + 1;
    const basicAmount = ti.TotalRewardTicks;
    await applyDepositPlanAndClaimAll(ti, rb);

    expect(await AGF.balanceOf(user1.address)).to.eq(basicAmount + min([boostAmount, basicAmount]));
    const startPostClaim = await currentTick();

    // simulate a successful redeem
    await rpAGF.handleBalanceUpdate(xAGF.address, user1.address, defaultStkAmount, 0, 0);

    await mineTicks(10);

    await rb.connect(user1).claimReward();
    const blocksWithoutStaking = (await currentTick()) - startPostClaim;

    expect(await AGF.balanceOf(user1.address)).to.eq(
      basicAmount + blocksWithoutStaking + min([boostAmount, basicAmount + blocksWithoutStaking])
    );
  });
});
