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
import {
  currentBlock,
  mineBlocks,
  mineToBlock,
  revertToSnapshotBlock,
  snapshotBlock,
} from './utils';
import { makeSuite } from './helpers/make-suite';
import { RAY } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

makeSuite('Team rewards suite', () => {
  let root: SignerWithAddress;
  let teamMember1: SignerWithAddress;
  let teamMember2: SignerWithAddress;
  let teamRewardPool: TeamRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;
  let blk;

  const PERC100 = 10000;
  const UNLOCK_BLOCK = 300;

  before(async () => {
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    blk = await snapshotBlock();
    [root, teamMember1, teamMember2] = await ethers.getSigners();
    await rawBRE.run('dev:agf-rewards', {
      teamRewardInitialRate: RAY,
      teamRewardBaselinePercentage: 0,
      teamRewardUnlockBlock: UNLOCK_BLOCK,
      teamRewardsFreezePercentage: PERC100 / 2,
    });
    rewardController = await getRewardFreezer();
    teamRewardPool = await getTeamRewardPool();
    agf = await getMockAgfToken();
  });

  afterEach(async () => {
    await revertToSnapshotBlock(blk);
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
    // TODO: check claim
  });

  it('can be unlocked on time', async () => {
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.false;
    await mineToBlock(UNLOCK_BLOCK + 1);
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
  });

  it('can not change block after unlock', async () => {
    await mineToBlock(UNLOCK_BLOCK + 1);
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    await expect(teamRewardPool.setUnlockBlock(await currentBlock())).to.be.revertedWith(
      'revert lockup is finished'
    );
  });

  it('can be locked again, check reward when locked', async () => {
    await mineBlocks(10);
    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
  });

  it('add team member, claim reward', async () => {
    console.log('-----------');
    // add new member, check shares, check claim after 100 blocks
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, PERC100 / 2);
    await teamRewardPool.connect(root).updateTeamMember(teamMember2.address, PERC100 / 2);

    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(PERC100, 'shares are wrong');
    await mineToBlock(UNLOCK_BLOCK + 1);

    expect(await teamRewardPool.isUnlocked(await currentBlock())).to.be.true;
    await (await rewardController.connect(teamMember1).claimReward()).wait(1);

    // expect(await rewardController.connect(teamMember1).claimReward())
    //   .to.emit(rewardController, 'RewardsClaimed')
    //   .withArgs(rewardController.address, teamMember1.address, 2000);

    // Calculations explained:
    // 1. user is added at block 189 // TODO: flacky!
    // 2. claim is made at block 302
    // 3. total = 113 blocks
    // 4. each block gives = teamRewardInitialRate / 1 RAY = 1 reward unit per block for 10000bp (100%)
    // 5. user share is 50%, so allocation is 113 * 1 unit * 5000bp (50%) = 56500 unit*bp = 56 reward units
    // 6. and 50% are frozen, so result is = 28 reward units
    expect(await agf.balanceOf(teamMember1.address)).to.eq(28);
  });
});
