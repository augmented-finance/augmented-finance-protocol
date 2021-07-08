import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardFreezer,
  getTeamRewardPool,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, TeamRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { waitForTx } from '../../helpers/misc-utils';
import { currentTick, mineTicks, mineToTicks, revertSnapshot, takeSnapshot } from './utils';
import { PERC_100 } from '../../helpers/constants';
import { calcTeamRewardForMember } from './helpers/utils/calculations_augmented';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let teamMember1: SignerWithAddress;
  let teamMember2: SignerWithAddress;
  let trp: TeamRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let blkAfterDeploy;
  let REWARD_UNLOCKED_AT;
  let rewardPrecision = 1.5;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, teamMember1, teamMember2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rewardController = await getRewardFreezer();
    trp = await getTeamRewardPool();
    agf = await getMockAgfToken();
    REWARD_UNLOCKED_AT = 10 + (await currentTick());
    console.log(`unlock at: ${REWARD_UNLOCKED_AT}`);
    await trp.setUnlockedAt(REWARD_UNLOCKED_AT);
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('share percentage 0 < share <= 10k', async () => {
    await expect(
      trp.connect(root).updateTeamMember(teamMember1.address, PERC_100 + 1)
    ).to.be.revertedWith('revert invalid share percentage');
    await expect(trp.connect(root).updateTeamMember(teamMember1.address, -1)).to.be.reverted;
  });

  it('can remove member, no reward can be claimed after', async () => {
    const memberShare = PERC_100 / 2;
    await trp.connect(root).updateTeamMember(teamMember1.address, memberShare);
    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(memberShare, 'shares are wrong');

    await trp.connect(root).removeTeamMember(teamMember1.address);
    const shares2 = await trp.getAllocatedShares();
    expect(shares2).to.eq(0, 'shares are wrong');

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await trp.isUnlocked(await currentTick())).to.be.true;

    console.log(`claim is made at: ${await currentTick()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.eq(0, 'reward is wrong');
  });

  it('can not change member share during lockup period', async () => {
    const memberShare = PERC_100 / 2;
    await waitForTx(await trp.connect(root).updateTeamMember(teamMember1.address, PERC_100 / 2));
    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(memberShare, 'shares are wrong');
    await expect(trp.connect(root).updateTeamMember(teamMember1.address, 0)).to.be.revertedWith(
      'revert member share can not be changed during lockup'
    );
  });

  it('can change member share to zero', async () => {
    const memberShare = PERC_100;
    await trp.connect(root).updateTeamMember(teamMember1.address, memberShare);
    let claimedInStepOne;
    {
      // rate #1 - 100% - 5 blocks
      await mineToTicks(REWARD_UNLOCKED_AT + 5);
      expect(await trp.isUnlocked(await currentTick())).to.be.true;
      const rewardCalc = await rewardController.claimableReward(teamMember1.address);
      console.log(`rewards = claimable: ${rewardCalc.claimable}, delayed: ${rewardCalc.extra}`);

      console.log(`claim is made at: ${await currentTick()}`);
      await rewardController.connect(teamMember1).claimReward();

      claimedInStepOne = await agf.balanceOf(teamMember1.address);
      expect(rewardCalc.extra).to.eq(0);
      expect(claimedInStepOne.toNumber()).to.be.approximately(
        rewardCalc.claimable.toNumber(),
        rewardPrecision,
        'reward is wrong'
      );
    }
    await trp.connect(root).updateTeamMember(teamMember1.address, 0);
    {
      // rate #2 - 0% - 5 blocks
      await mineToTicks(REWARD_UNLOCKED_AT + 10);
      const rewardCalc = await rewardController.claimableReward(teamMember1.address);
      console.log(`rewards = claimable: ${rewardCalc.claimable}, delayed: ${rewardCalc.extra}`);

      console.log(`claim is made at: ${await currentTick()}`);
      await rewardController.connect(teamMember1).claimReward();
      expect(rewardCalc.extra).to.eq(0);
      const rewardClaimed = await agf.balanceOf(teamMember1.address);
      expect(rewardClaimed.toNumber()).to.be.approximately(
        claimedInStepOne.toNumber(),
        rewardPrecision,
        'reward is wrong'
      );
    }
  });

  it('can be unlocked at time', async () => {
    expect(await trp.isUnlocked(REWARD_UNLOCKED_AT - 1)).to.be.false;
    expect(await trp.isUnlocked(REWARD_UNLOCKED_AT)).to.be.false;
    expect(await trp.isUnlocked(REWARD_UNLOCKED_AT + 1)).to.be.true;
  });

  it('can not change after unlock', async () => {
    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    await expect(trp.setUnlockedAt(await currentTick())).to.be.revertedWith(
      'revert lockup is finished'
    );
  });

  it('can pause/unpause pool, sets rate to zero', async () => {
    await trp.connect(root).setPaused(true);
    await trp.connect(root).updateTeamMember(teamMember1.address, PERC_100);
    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    await rewardController.connect(teamMember1).claimReward();
    expect(await agf.balanceOf(teamMember1.address)).to.eq(0);
    await trp.connect(root).setPaused(false);
    await mineTicks(1);
    await rewardController.connect(teamMember1).claimReward();
    expect(await agf.balanceOf(teamMember1.address)).to.eq(2);
  });

  it('one team member with 100% share (0% frozen) claims all', async () => {
    console.log('-----------');
    console.log(`members added at: ${await currentTick()}`);
    const userShare = PERC_100;
    await trp.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToTicks(REWARD_UNLOCKED_AT + 1);

    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    const expectedReward = calcTeamRewardForMember(
      blocksPassed,
      CFG.teamRewardInitialRate,
      userShare,
      0
    );
    console.log(`claim is made at: ${await currentTick()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    console.log('-----------');
  });

  it('two team members with 50% share (0% frozen) claim 50% each', async () => {
    console.log('-----------');
    console.log(`members added at: ${await currentTick()}`);
    const userShare = PERC_100 / 2; // 50%
    await trp.connect(root).updateTeamMember(teamMember1.address, userShare);
    await trp.connect(root).updateTeamMember(teamMember2.address, userShare);

    const blocksPassed = await mineToTicks(REWARD_UNLOCKED_AT + 1);

    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(PERC_100, 'shares are wrong');

    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    const expectedReward = calcTeamRewardForMember(
      blocksPassed,
      CFG.teamRewardInitialRate,
      userShare,
      0
    );
    console.log(`claim is made at: ${await currentTick()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    await (await rewardController.connect(teamMember2).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    const rewardClaimed2 = await agf.balanceOf(teamMember2.address);
    expect(rewardClaimed2.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    console.log('-----------');
  });

  it('one team member, with 100% share (33.33% frozen)', async () => {
    console.log('-----------');
    console.log(`members added at: ${await currentTick()}`);
    const userShare = PERC_100;
    const freezePercent = 3333;

    await rewardController.setFreezePercentage(freezePercent);
    await trp.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToTicks(REWARD_UNLOCKED_AT + 1);

    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    const expectedReward = calcTeamRewardForMember(
      blocksPassed,
      CFG.teamRewardInitialRate,
      userShare,
      freezePercent
    );
    console.log(`claim is made at: ${await currentTick()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    console.log('-----------');
  });

  it('one team member, with 100% share (100% frozen), no reward', async () => {
    console.log('-----------');
    console.log(`members added at: ${await currentTick()}`);
    const userShare = PERC_100;
    const freezePercent = PERC_100;

    await rewardController.setFreezePercentage(freezePercent);
    await trp.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToTicks(REWARD_UNLOCKED_AT + 1);

    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    const expectedReward = calcTeamRewardForMember(
      blocksPassed,
      CFG.teamRewardInitialRate,
      userShare,
      freezePercent
    );
    console.log(`claim is made at: ${await currentTick()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    console.log('-----------');
  });

  it('one team member, with 100% share (33.33% frozen) calc reward', async () => {
    console.log('-----------');
    console.log(`members added at: ${await currentTick()}`);
    const userShare = PERC_100;
    const freezePercent = 3333;

    await rewardController.setFreezePercentage(freezePercent);
    await trp.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToTicks(REWARD_UNLOCKED_AT + 1);

    const shares = await trp.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await trp.isUnlocked(await currentTick())).to.be.true;
    const expectedReward = calcTeamRewardForMember(
      blocksPassed,
      CFG.teamRewardInitialRate,
      userShare,
      freezePercent
    );
    console.log(`calc is made at: ${await currentTick()}`);
    const rewardCalc = await rewardController.claimableReward(teamMember1.address);
    expect(rewardCalc.claimable.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'claimable is wrong'
    );
    expect(rewardCalc.extra.toNumber()).to.be.approximately(
      expectedReward / 2,
      rewardPrecision,
      'delayed is wrong'
    );
    console.log('-----------');
  });
});
