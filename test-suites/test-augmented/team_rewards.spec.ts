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
import { currentBlock, mineBlocks } from './utils';

chai.use(solidity);
const { expect } = chai;

// makeSuite('Rewards test suite', (testEnv: TestEnv) => {
describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let teamMember1: SignerWithAddress;
  let teamMember2: SignerWithAddress;
  let teamRewardPool: TeamRewardPool;
  let rewardController: RewardFreezer;
  let agf: MockAgfToken;

  const PERC100 = 10000;

  beforeEach(async () => {
    [root, teamMember1, teamMember2] = await ethers.getSigners();
    await rawBRE.run('set-DRE');
    await rawBRE.run('dev:augmented-access');
    await rawBRE.run('dev:agf-rewards', {
      teamRewardInitialRate: 1,
      teamRewardBaselinePercentage: 0,
      teamRewardUnlockBlock: 1,
      teamRewardsFreezePercentage: PERC100 / 2,
    });
    rewardController = await getRewardFreezer();
    teamRewardPool = await getTeamRewardPool();
    agf = await getMockAgfToken();
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
    expect(shares).to.eq(0, 'shares are wrong');
    // TODO: check claim
  });

  it.only('can change member share to zero', async () => {
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

  it('add team member, claim reward', async () => {
    // add new member, check shares, check claim after 100 blocks
    await teamRewardPool.connect(root).updateTeamMember(teamMember1.address, PERC100 / 2);
    await teamRewardPool.connect(root).updateTeamMember(teamMember2.address, PERC100 / 2);
    const shares = await teamRewardPool.getAllocatedShares();
    expect(shares).to.eq(PERC100, 'shares are wrong');
    await mineBlocks(100);
    await currentBlock();

    await waitForTx(await rewardController.connect(teamMember1).claimReward());
    expect(await agf.balanceOf(teamMember1.address)).to.eq(2000);
  });
});
