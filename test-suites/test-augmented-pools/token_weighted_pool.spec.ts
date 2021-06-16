import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardFreezer,
  getTokenWeightedRewardPoolAGFSeparate,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, TokenWeightedRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { currentBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { applyDepositPlanAndClaimAll, TestInfo } from '../test_utils';

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
  let blkAfterDeploy;
  let rewardPrecision = 1;
  // reward per block is 100, see deploy
  const rewardPerBlock = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardFreezer();
    wrp = await getTokenWeightedRewardPoolAGFSeparate();
    agf = await getMockAgfToken();
    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  // const applyBalanceChanges = async (ti: TestInfo) => {
  //   printTestInfo(ti);
  //   console.log(`current block: ${await currentBlock()}`);
  //   // applying balance changes in order
  //   ti.UserBalanceChanges = _.sortBy(ti.UserBalanceChanges, 'block');
  //
  //   let totalSetupBlocks = 0;
  //   for (let u of ti.UserBalanceChanges) {
  //     expect(await agf.balanceOf(u.Signer.address)).to.eq(0);
  //     // mine to set balance update for relative block
  //     if (u.BlocksFromStart !== 0) {
  //       totalSetupBlocks += await mineBlocks(u.BlocksFromStart);
  //     }
  //     await wrp.handleBalanceUpdate(
  //       ONE_ADDRESS,
  //       u.Signer.address,
  //       u.AmountDepositedBefore,
  //       u.AmountDeposited,
  //       ti.TotalAmountDeposited
  //     );
  //   }
  //   const uniq_addresses = [...new Set(ti.UserBalanceChanges.map((item) => item.Signer.address))];
  //   // mine the rest blocks until ti.TotalRewardBlocks,
  //   // subtract already mined blocks + blocks with claims afterwards
  //   await mineBlocks(ti.TotalRewardBlocks - totalSetupBlocks - uniq_addresses.length);
  //   // claim for every user only once
  //   for (let ua of uniq_addresses) {
  //     for (let s of ti.UserBalanceChanges) {
  //       if (ua === s.Signer.address) {
  //         await rc.connect(s.Signer).claimReward();
  //       }
  //     }
  //   }
  // };

  it('20 blocks, 100% deposited, 0% frozen, meltdown immediately', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 1000000 },
      ],
      BlocksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    console.log(`reward: ${reward}`);
    expect(reward).to.be.approximately(
      ti.TotalRewardBlocks * rewardPerBlock,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 50% deposited, 0% frozen, meltdown immediately', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 500000 },
      ],
      BlocksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(
      (ti.TotalRewardBlocks * rewardPerBlock) / 2,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +20 blocks, all melted', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 1000000 },
      ],
      BlocksToMeltdown: 20,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(
      ti.TotalRewardBlocks * rewardPerBlock,
      rewardPrecision,
      'reward is wrong'
    );
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +40 blocks, partly melted', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 1000000 },
      ],
      BlocksToMeltdown: 40,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(510, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 100% deposited, 100% frozen, meltdown at +80 blocks, partly melted', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 1000000 },
      ],
      BlocksToMeltdown: 80,
      FreezePercentage: 10000,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(250, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 50% deposited, 2 users', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 500000 },
        { Signer: user2, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 500000 },
      ],
      BlocksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    const reward2 = (await agf.balanceOf(user2.address)).toNumber();
    expect(reward).to.be.approximately(1000, rewardPrecision, 'reward is wrong');
    expect(reward2).to.be.approximately(1000, rewardPrecision, 'reward is wrong');
  });

  it('20 blocks, 100% withdraw on block +10, half rewards payed', async () => {
    const ti = {
      TotalRewardBlocks: 20,
      TotalAmountDeposited: 1000000,
      UserBalanceChanges: [
        { Signer: user1, BlocksFromStart: 0, AmountDepositedBefore: 0, AmountDeposited: 1000000 },
        { Signer: user1, BlocksFromStart: 10, AmountDepositedBefore: 1000000, AmountDeposited: 0 },
      ],
      BlocksToMeltdown: 0,
      FreezePercentage: 0,
    } as TestInfo;
    await rc.admin_setFreezePercentage(ti.FreezePercentage);
    await rc.admin_setMeltDownBlock((await currentBlock()) + ti.BlocksToMeltdown);
    await applyDepositPlanAndClaimAll(ti, wrp, rc);
    const reward = (await agf.balanceOf(user1.address)).toNumber();
    expect(reward).to.be.approximately(1099, rewardPrecision, 'reward is wrong');
  });
});
