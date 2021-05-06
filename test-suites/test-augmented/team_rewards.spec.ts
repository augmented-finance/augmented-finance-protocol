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
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from './utils';
import { PERCENTAGE_FACTOR, RAY } from '../../helpers/constants';
import BigNumber from 'bignumber.js';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let teamMember1: SignerWithAddress;
  let teamMember2: SignerWithAddress;
  let teamRewardPool: TeamRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let blkAfterDeploy;
  let REWARD_UNLOCK_BLOCK;
  let teamRewardInitialRate: string = RAY;
  let teamRewardsFreezePercentage = 0;
  let rewardPrecision = 1;

  // see contracts/tools/math/PercentageMath.sol
  const PERC100 = Number(PERCENTAGE_FACTOR);

  const calcReward = (
    blocksPassed: number,
    teamRewardInitialRate: string,
    userShare: number,
    teamRewardsFreezePercentage: number
  ): number => {
    console.log(`blocks passed: ${blocksPassed}`);
    const rewardForBlock = new BigNumber(teamRewardInitialRate).div(RAY);
    console.log(`one block gives rewards: ${rewardForBlock.toFixed()}`);
    // reward consists of
    // number of blocks passed * reward for block * userShare (PCT) / 10000 (10k = 100%)
    const reward = (blocksPassed * rewardForBlock.toNumber() * userShare) / PERC100;
    // minus percentage of freezed reward
    const minusFreezedPart = (reward * (PERC100 - teamRewardsFreezePercentage)) / PERC100;
    console.log(`reward: ${minusFreezedPart}`);
    return minusFreezedPart;
  };

  before(async () => {
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    [root, teamMember1, teamMember2] = await ethers.getSigners();
    await rawBRE.run('dev:agf-rewards', {
      teamRewardInitialRate: teamRewardInitialRate,
      teamRewardBaselinePercentage: 0,
      teamRewardUnlockBlock: 1000,
      teamRewardsFreezePercentage: teamRewardsFreezePercentage,
    });
    rewardController = await getRewardFreezer();
    teamRewardPool = await getTeamRewardPool();
    agf = await getMockAgfToken();

    blkAfterDeploy = await currentBlock();
    REWARD_UNLOCK_BLOCK = blkAfterDeploy + 100;
    console.log(`unlock block at: ${REWARD_UNLOCK_BLOCK}`);
    await teamRewardPool.setUnlockBlock(REWARD_UNLOCK_BLOCK);
  });

  it('share percentage 0 < share <= 10k', async () => {
    await expect(
      teamRewardPool.connect(root).updateTeamMember(teamMember1.address, PERC100 + 1)
    ).to.be.revertedWith('revert invalid share percentage');
    await expect(teamRewardPool.connect(root).updateTeamMember(teamMember1.address, -1)).to.be
      .reverted;
  });

  it('can remove member', async () => {
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, PERC100 / 2);
    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(PERC100 / 2, 'shares are wrong');

    await teamRewardPool.connect(root).removeTeamMember(teamMember1.address);
    const shares2 = await teamRewardPool.getAllocatedShares();
    expect(shares2).to.eq(0, 'shares are wrong');
    // TODO: check claim
  });

  it('can change member share to zero', async () => {
    await waitForTx(
      await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, PERC100 / 2)
    );
    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(PERC100 / 2, 'shares are wrong');
    await waitForTx(await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, 0));
    const shares2 = await teamRewardPool.getAllocatedShares();
    expect(shares2).to.eq(0, 'shares are wrong');
  });

  it('can be unlocked on time', async () => {
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.false;
    await mineToBlock(REWARD_UNLOCK_BLOCK + 1);
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
  });

  it('can not change block after unlock', async () => {
    await mineToBlock(REWARD_UNLOCK_BLOCK + 1);
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    await expect(teamRewardPool.setUnlockBlock(await currentBlock())).to.be.revertedWith(
      'revert lockup is finished'
    );
  });

  it('one team member with 100% share (0% frozen) claims all', async () => {
    console.log('-----------');
    console.log(`members added at block: ${await currentBlock()}`);
    const userShare = PERC100;
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToBlock(REWARD_UNLOCK_BLOCK + 1);

    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    const expectedReward = calcReward(blocksPassed, teamRewardInitialRate, userShare, 0);
    console.log(`claim is made at block: ${await currentBlock()}`);
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
    console.log(`members added at block: ${await currentBlock()}`);
    const userShare = PERC100 / 2; // 50%
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, userShare);
    await teamRewardPool.connect(root).updateTeamMember(teamMember2.address, userShare);

    const blocksPassed = await mineToBlock(REWARD_UNLOCK_BLOCK + 1);

    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(PERC100, 'shares are wrong');

    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    const expectedReward = calcReward(blocksPassed, teamRewardInitialRate, userShare, 0);
    console.log(`claim is made at block: ${await currentBlock()}`);
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
    console.log(`members added at block: ${await currentBlock()}`);
    const userShare = PERC100;
    await rewardController.admin_setFreezePercentage(3333);
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, userShare);

    const blocksPassed = await mineToBlock(REWARD_UNLOCK_BLOCK + 1);

    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(userShare, 'shares are wrong');

    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    const expectedReward = calcReward(blocksPassed, teamRewardInitialRate, userShare, 3333);
    console.log(`claim is made at block: ${await currentBlock()}`);
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);
    const rewardClaimed = await agf.balanceOf(teamMember1.address);
    expect(rewardClaimed.toNumber()).to.be.approximately(
      expectedReward,
      rewardPrecision,
      'reward is wrong'
    );
    console.log('-----------');
  });
});
