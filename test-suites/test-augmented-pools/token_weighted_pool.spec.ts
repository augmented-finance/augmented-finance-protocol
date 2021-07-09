import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardController,
  getTokenWeightedRewardPoolAGFSeparate,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, TokenWeightedRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { currentTick, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { applyDepositPlanAndClaimAll, TestInfo } from '../test_utils';
import { ONE_ADDRESS } from '../../helpers/constants';
import { deflateSync } from 'zlib';

chai.use(solidity);
const { expect } = chai;

describe('Token weighted reward pool tests', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rc: RewardFreezer;
  let agf: MockAgfToken;
  let wrp: TokenWeightedRewardPool;
  let blkBeforeDeploy;
  let rewardPrecision = 1;
  // reward per block is 100, see deploy
  const rewardPerBlock = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardController();
    wrp = await getTokenWeightedRewardPoolAGFSeparate();
    agf = await getMockAgfToken();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('20 blocks, 100% deposited, 0% frozen, meltdown immediately', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 1000000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    console.log(`reward: ${reward}`);
    expect(reward).to.be.approximately(
      ti.TotalRewardTicks * rewardPerBlock,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 50% deposited, 0% frozen, meltdown immediately', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 500000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(
      (ti.TotalRewardTicks * rewardPerBlock) / 2,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +20 blocks, all melted', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 1000000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 20,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(
      ti.TotalRewardTicks * rewardPerBlock,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +40 blocks, partly melted', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 1000000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 40,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(520, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +80 blocks, partly melted', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 1000000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 80,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(250, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 50% deposited, 2 users', async () => {
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 500000,
          TotalAmountDeposited: 500000,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 500000,
          TotalAmountDeposited: 1000000,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    const reward2 = (await agf.balanceOf(user2.address)).toNumber();
    expect(reward).to.be.approximately(1050, rewardPrecision, 'reward is wrong'); // first tick takes 100% of reward
    expect(reward2).to.be.approximately(1000, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 100% withdraw on block +10, half rewards paid', async () => { 
    const ti = {
      TotalRewardTicks: 20,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: 1000000,
          TotalAmountDeposited: 1000000,
        },
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 10,
          AmountDepositedBefore: 1000000,
          AmountDeposited: 0,
          TotalAmountDeposited: 0,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(1000, rewardPrecision, 'reward is wrong');
  });

  it('weights check, user1 is static, user2 changes balance, small step', async () => { 
    const UNIT = 1e9;
    const STEP = 50;
    const ti = {
      TotalRewardTicks: 6*STEP,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: UNIT,
          TotalAmountDeposited: UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: STEP,
          AmountDepositedBefore: 0,
          AmountDeposited: UNIT,
          TotalAmountDeposited: 2*UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 2*STEP,
          AmountDepositedBefore: UNIT,
          AmountDeposited: 3*UNIT,
          TotalAmountDeposited: 4*UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 3*STEP,
          AmountDepositedBefore: 3*UNIT,
          AmountDeposited: 2*UNIT,
          TotalAmountDeposited: 3*UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 4*STEP,
          AmountDepositedBefore: 2*UNIT,
          AmountDeposited: UNIT,
          TotalAmountDeposited: 2*UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 5*STEP,
          AmountDepositedBefore: UNIT,
          AmountDeposited: 0,
          TotalAmountDeposited: UNIT,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);

    const expected1 = (100 + 50 + 25 + 33.33 + 50)*STEP + 100*(STEP-1); // -1 is because of the last tick is spent to claim for user2
    expect((await agf.balanceOf(user1.address)).toNumber()).to.be.approximately(expected1, STEP/3, 'reward is wrong');

    const expected2 = (0 + 50 + 75 + 66.66 + 50 + 0)*STEP; 
    expect((await agf.balanceOf(user2.address)).toNumber()).to.be.approximately(expected2, STEP/3, 'reward is wrong');
  });

  it('weights check, both users change balances, large step', async () => { 
    const UNIT = 1e9;
    const STEP = 60*60*24;
    const ti = {
      TotalRewardTicks: 4*STEP,
      UserBalanceChanges: [
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 0,
          AmountDepositedBefore: 0,
          AmountDeposited: UNIT,
          TotalAmountDeposited: UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: STEP,
          AmountDepositedBefore: 0,
          AmountDeposited: 2*UNIT,
          TotalAmountDeposited: 3*UNIT,
        },
        {
          Signer: user1,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 2*STEP,
          AmountDepositedBefore: UNIT,
          AmountDeposited: 2*UNIT,
          TotalAmountDeposited: 4*UNIT,
        },
        {
          Signer: user2,
          Pool: wrp,
          TokenAddress: ONE_ADDRESS,
          TicksFromStart: 3*STEP,
          AmountDepositedBefore: 2*UNIT,
          AmountDeposited: 0,
          TotalAmountDeposited: 2*UNIT,
        },
      ],
      TicksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.setFreezePercentage(ti.FreezePercentage);
    await rc.setMeltDownAt((await currentTick()) + ti.TicksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, rc);

    const expected1 = (100 + 33.33 + 50) * STEP + 100*(STEP-1); // -1 is because of the last tick is spent to claim for user2
    expect((await agf.balanceOf(user1.address)).toNumber()).to.be.approximately(expected1, STEP/3, 'reward is wrong');

    const expected2 = (0 + 66.66 + 50 + 0)*STEP;
    expect((await agf.balanceOf(user2.address)).toNumber()).to.be.approximately(expected2, STEP/3, 'reward is wrong');
  });
});
