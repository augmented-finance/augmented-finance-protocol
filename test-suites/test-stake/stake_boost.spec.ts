import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getAGTokenByName,
  getMockAgfToken,
  getMockStakedAgfToken,
  getRewardBooster,
  getTokenWeightedRewardPoolAGBoosted,
  getTokenWeightedRewardPoolAGFBoosted,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  CFG,
} from '../../tasks/migrations/defaultTestDeployConfig';
import { currentBlock, mineBlocks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumberish } from 'ethers';
import {
  DepositToken,
  MockAgfToken,
  MockStakedAgfToken,
  RewardBooster,
  RewardFreezer,
  TokenWeightedRewardPool,
} from '../../types';
import { applyDepositPlanAndClaimAll, TestInfo } from '../test_utils';

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
  let AG: DepositToken;
  let rpAGF: TokenWeightedRewardPool;
  let rpAG: TokenWeightedRewardPool;
  let blkBeforeDeploy;
  let blkAfterDeploy;
  const defaultStkAmount = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2, slasher] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local-staking', CFG);
    rb = await getRewardBooster();

    AG = await getAGTokenByName('agDAI');
    rpAG = await getTokenWeightedRewardPoolAGBoosted();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGFBoosted();

    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('no boost if no work and no staking', async () => {
    await mineBlocks(5);
    await rb.connect(user1).claimReward();
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
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
      TotalAmountDeposited: 10000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 10000 },
      ],
    } as TestInfo;

    // basic work of the deposit - deposit is added one block after the stake
    const basicAmount = ti.TotalRewardBlocks - 1;
    const boostAmount = ti.TotalRewardBlocks;

    await applyDepositPlanAndClaimAll(ti, rpAG, rb);
    expect(await AGF.balanceOf(user1.address)).to.eq(boostAmount + basicAmount);
  });

  it('deposit agDAI for 10 blocks, redeem, wait 10 blocks and get full reward', async () => {
    await rpAGF.handleBalanceUpdate(
      xAGF.address,
      user1.address,
      0,
      defaultStkAmount,
      defaultStkAmount
    );
    const ti = {
      TotalRewardBlocks: 10,
      TotalAmountDeposited: 10000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 10000 },
      ],
    } as TestInfo;
    // basic work of the deposit - deposit is added one block after the stake
    const basicAmount = ti.TotalRewardBlocks - 1;
    const boostAmount = ti.TotalRewardBlocks;
    await applyDepositPlanAndClaimAll(ti, rpAG, rb);

    // simulate a successful redeem
    await rpAGF.handleBalanceUpdate(xAGF.address, user1.address, defaultStkAmount, 0, 0);

    const blocksWithoutStaking = 10;
    // one block is consumed by the next claimReward()
    await mineBlocks(blocksWithoutStaking - 1);
    await rb.connect(user1).claimReward();

    expect(await AGF.balanceOf(user1.address)).to.eq(
      boostAmount + basicAmount + blocksWithoutStaking * 1 // deposit gives gives 1 agf per block
    );
  });
});
