import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getAGTokenByName,
  getMockAgfToken,
  getMockStakedAgfToken,
  getRewardBooster,
  getTokenWeightedRewardPoolAGBoosted,
  getTokenWeightedRewardPoolAGFBooster, getTokenWeightedRewardPoolAGUSDCBoosted,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CFG, stakingCooldownBlocks } from '../../tasks/migrations/defaultTestDeployConfig';
import { currentBlock, mineBlocks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import {
  DepositToken,
  MockAgfToken,
  MockStakedAgfToken,
  RewardBooster,
  TokenWeightedRewardPool,
} from '../../types';
import { applyDepositPlanAndClaimAll, TestInfo } from '../test_utils';
import { PERC_100 } from '../../helpers/constants';

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
  let blkAfterDeploy;
  const defaultStkAmount = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2, slasher] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local-staking', CFG);
    rb = await getRewardBooster();

    agDAI = await getAGTokenByName('agDAI');
    agUSDC = await getAGTokenByName('agUSDC');
    rpAGDAI = await getTokenWeightedRewardPoolAGBoosted();
    rpUSDC = await getTokenWeightedRewardPoolAGUSDCBoosted();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGFBooster();

    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('no boost if no staking', async () => {
    await mineBlocks(stakingCooldownBlocks);
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
    await mineBlocks(rewardingBlocks);
    await rb.connect(user1).claimReward();
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
  });

  it.skip('agDAI boost factor set to zero, get rewards', async () => {
    await rb.connect(root).setBoostFactor(rpAGDAI.address, 0);
    const ti = {
      TotalRewardBlocks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
        {
          Signer: user1,
          Pool: rpUSDC,
          TokenAddress: agUSDC.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    // basic work of the deposit
    const basicAmount = ti.TotalRewardBlocks;
    const boostAmount = ti.TotalRewardBlocks;

    await applyDepositPlanAndClaimAll(ti, rb);
    const numberOfWorkingPools = 0;
    expect(await AGF.balanceOf(user1.address)).to.eq(
      boostAmount * numberOfWorkingPools + basicAmount
    );
  });

  it('multiple deposits for work', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGF,
          TokenAddress: xAGF.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: defaultStkAmount,
          TotalAmountDeposited: defaultStkAmount,
        },
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
        {
          Signer: user1,
          Pool: rpUSDC,
          TokenAddress: agUSDC.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    // basic work of the deposit
    const basicAmount = ti.TotalRewardBlocks;
    const boostAmount = ti.TotalRewardBlocks;

    await applyDepositPlanAndClaimAll(ti, rb);
    const numberOfWorkingPools = 2;
    expect(await AGF.balanceOf(user1.address)).to.eq(
      boostAmount * numberOfWorkingPools + basicAmount
    );
  });

  it('can stake AGF to xAGF, deposit agDAI for 20 blocks, receive boost reward', async () => {
    await rpAGF.handleBalanceUpdate(
      xAGF.address,
      user1.address,
      0,
      defaultStkAmount,
      defaultStkAmount
    );
    const ti = {
      TotalRewardBlocks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;

    // basic work of the deposit - deposit is added one block after the stake
    const basicAmount = ti.TotalRewardBlocks - 2;
    const boostAmount = ti.TotalRewardBlocks;

    await applyDepositPlanAndClaimAll(ti, rb);
    expect(await AGF.balanceOf(user1.address)).to.eq(boostAmount + basicAmount);
  });

  it('deposit agDAI for 10 blocks, redeem, wait 10 blocks and still get full reward', async () => {
    await rpAGF.handleBalanceUpdate(
      xAGF.address,
      user1.address,
      0,
      defaultStkAmount,
      defaultStkAmount
    );
    const ti = {
      TotalRewardBlocks: 10,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: rpAGDAI,
          TokenAddress: agDAI.address,
          BlocksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 10000,
          TotalAmountDeposited: 10000,
        },
      ],
    } as TestInfo;
    // basic work of the deposit - deposit is added one block after the stake
    const basicAmount = ti.TotalRewardBlocks - 2;
    const boostAmount = ti.TotalRewardBlocks;
    await applyDepositPlanAndClaimAll(ti, rb);

    // simulate a successful redeem
    await rpAGF.handleBalanceUpdate(xAGF.address, user1.address, defaultStkAmount, 0, 0);

    const blocksWithoutStaking = 10;
    // one block is consumed by the next claimReward()
    await mineBlocks(blocksWithoutStaking - 1);
    await rb.connect(user1).claimReward();

    const rewardPerBlock = 1; // deposit gives gives 1 agf per block

    expect(await AGF.balanceOf(user1.address)).to.eq(
      boostAmount + basicAmount + blocksWithoutStaking * rewardPerBlock
    );
  });
});
