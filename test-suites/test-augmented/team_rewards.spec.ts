import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import { getMockAgfToken, getMockRewardFreezer, getTeamRewardPool } from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, TeamRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { getSigners } from '../../helpers/misc-utils';
import { currentTick, mineTicks, mineToTicks, revertSnapshot, takeSnapshot } from './utils';
import { PERC_100 } from '../../helpers/constants';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let member1: SignerWithAddress;
  let member2: SignerWithAddress;
  let pool: TeamRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let REWARD_UNLOCKED_AT: number;
  let rewardPrecision = 1.5;

  before(async () => {
    await rawBRE.run('augmented:test-local', CFG);

    [root, member1, member2] = await getSigners();
    rewardController = await getMockRewardFreezer();
    await rewardController.setMeltDownAt(1);
    pool = await getTeamRewardPool();
    agf = await getMockAgfToken();
    REWARD_UNLOCKED_AT = 10 + (await currentTick());
    await pool.setUnlockedAt(REWARD_UNLOCKED_AT);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('share percentage 0 <= share <= 10000bp (100%)', async () => {
    await expect(pool.updateTeamMember(member1.address, PERC_100 + 1)).to.be.revertedWith('invalid share percentage');
  });

  it('member share change during lockup', async () => {
    await pool.updateTeamMember(member1.address, PERC_100);
    const startedAt = await currentTick();

    expect(await pool.getAllocatedShares()).to.eq(PERC_100);
    await mineTicks(2);

    await pool.updateTeamMember(member1.address, 0);
    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal);

    {
      const reward = await rewardController.claimableReward(member1.address);
      expect(reward.claimable).eq(0);
      expect(reward.extra).eq(expectedReward);
    }

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;

    {
      const reward = await rewardController.claimableReward(member1.address);
      expect(reward.claimable).eq(expectedReward);
      expect(reward.extra).eq(0);
    }
  });

  it('unlocked at the given time', async () => {
    expect(await pool.isUnlocked(REWARD_UNLOCKED_AT - 1)).to.be.false;
    expect(await pool.isUnlocked(REWARD_UNLOCKED_AT)).to.be.false;
    expect(await pool.isUnlocked(REWARD_UNLOCKED_AT + 1)).to.be.true;
  });

  it('can not lock after unlock', async () => {
    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;
    await expect(pool.setUnlockedAt(await currentTick())).to.be.revertedWith('lockup is finished');
  });

  it('can pause/unpause pool, sets rate to zero', async () => {
    await pool.setPaused(true);
    await pool.updateTeamMember(member1.address, PERC_100);

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    await rewardController.connect(member1).claimReward();
    expect(await agf.balanceOf(member1.address)).to.eq(0);
    await pool.setPaused(false);

    const startedAt = await currentTick();
    await mineTicks(1);

    await rewardController.connect(member1).claimReward();

    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal);
    expect(await agf.balanceOf(member1.address)).eq(expectedReward);
  });

  it('a member with 100% share claims all', async () => {
    const userShare = PERC_100;

    await pool.updateTeamMember(member1.address, userShare);
    const startedAt = await currentTick();

    expect(await pool.getAllocatedShares()).to.eq(userShare);

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;
    await rewardController.connect(member1).claimReward();

    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal);

    expect(await agf.balanceOf(member1.address)).eq(expectedReward);
  });

  it('two members with claim by shares', async () => {
    const userShare = PERC_100 / 4; // 25%

    await pool.updateTeamMembers([member1.address, member2.address], [userShare, PERC_100 - userShare]);
    const startedAt = await currentTick();

    expect(await pool.getAllocatedShares()).to.eq(PERC_100);

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;

    await rewardController.connect(member1).claimReward();
    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal);
    const user1Reward = expectedReward.mul(userShare).div(PERC_100);
    expect((await agf.balanceOf(member1.address)).sub(user1Reward)).lte(1);

    await rewardController.connect(member2).claimReward();
    expect((await agf.balanceOf(member2.address)).sub(expectedReward.sub(user1Reward))).lte(1);
  });

  it('without members excess collects all', async () => {
    await pool.setExcessTarget(member1.address);
    const startedAt = await currentTick();

    const rewardBase = await rewardController.claimableReward(member1.address);
    expect(rewardBase.claimable).eq(0);
    expect(rewardBase.extra).gt(0);

    expect(await pool.getAllocatedShares()).to.eq(0);

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;

    // changing target before claim will also "transfer" unclaimed rewards
    await pool.setExcessTarget(member2.address);
    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal);

    {
      const reward = await rewardController.claimableReward(member1.address);
      expect(0).eq(reward.claimable);
      expect(0).eq(reward.extra);
    }

    {
      const reward = await rewardController.claimableReward(member2.address);
      expect(rewardBase.extra.add(expectedReward)).eq(reward.claimable);
      expect(0).eq(reward.extra);
    }
  });

  it('excess collects reward not allocated to the member', async () => {
    const userShare = PERC_100 / 2;
    await pool.setExcessTarget(member2.address);
    await pool.updateTeamMember(member1.address, userShare);
    const startedAt = await currentTick();

    const rewardBase = await rewardController.claimableReward(member2.address);
    expect(rewardBase.claimable).eq(0);
    expect(rewardBase.extra).gt(0);

    expect(await pool.getAllocatedShares()).to.eq(userShare);

    await mineToTicks(REWARD_UNLOCKED_AT + 1);
    expect(await pool.isUnlocked(await currentTick())).to.be.true;

    await rewardController.connect(member1).claimReward();
    expect((await rewardController.claimableReward(member1.address)).claimable).eq(0);

    const ticksTotal = (await currentTick()) - startedAt;
    const expectedReward = (await pool.getRate()).mul(ticksTotal).mul(userShare).div(PERC_100);
    expect((await agf.balanceOf(member1.address)).sub(expectedReward)).lte(1);

    await rewardController.connect(member2).claimReward();
    expect((await rewardController.claimableReward(member2.address)).claimable).eq(0);

    const ticksTotalExcess = (await currentTick()) - startedAt;
    const expectedExcess = (await pool.getRate()).mul(ticksTotalExcess).add(rewardBase.extra).sub(expectedReward);
    expect((await agf.balanceOf(member2.address)).sub(expectedExcess)).lte(1);
  });
});
