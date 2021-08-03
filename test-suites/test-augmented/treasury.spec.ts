import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import {
  getMarketAccessController,
  getMockAgfToken,
  getMockRewardFreezer,
  getTreasuryProxy,
} from '../../helpers/contracts-getters';

import { MarketAccessController, MockAgfToken, RewardFreezer, Treasury } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { mineTicks, revertSnapshot, takeSnapshot } from './utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { deployTreasuryImpl, deployTreasuryRewardPool } from '../../helpers/contracts-deployments';
import { TreasuryRewardPool } from '../../types/TreasuryRewardPool';
import { AccessFlags } from '../../helpers/access-flags';

chai.use(solidity);
const { expect } = chai;

describe('Treasury rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rewardController: RewardFreezer;
  let trp: TreasuryRewardPool;
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let ac: MarketAccessController;
  let treasury: Treasury;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await (<any>rawBRE).ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    agf = await getMockAgfToken();
    rewardController = await getMockRewardFreezer();

    ac = await getMarketAccessController();

    await ac.unmarkProxies(AccessFlags.REWARD_TOKEN | AccessFlags.REWARD_CONTROLLER);
    await ac.setAddress(AccessFlags.REWARD_TOKEN, agf.address); // don't use proxy
    await ac.setAddress(AccessFlags.REWARD_CONTROLLER, rewardController.address); // don't use proxy

    const treasuryImpl = await deployTreasuryImpl(false, false);
    await ac.setAddressAsProxy(AccessFlags.TREASURY, treasuryImpl.address);

    treasury = await getTreasuryProxy(await ac.getTreasury());
    await ac.grantRoles(user1.address, AccessFlags.TREASURY_ADMIN);
    await rewardController.setFreezePercentage(0);
    trp = await deployTreasuryRewardPool([rewardController.address, 1, 0, treasury.address]);
    await rewardController.addRewardPool(trp.address);
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('revert without permissions', async () => {
    await agf.mintReward(treasury.address, 10, false);

    await expect(
      treasury.connect(user2).approve(agf.address, user1.address, 10)
    ).to.be.revertedWith('RESTRICTED');

    await expect(
      treasury.connect(user2).transfer(agf.address, user1.address, 10)
    ).to.be.revertedWith('RESTRICTED');

    await expect(treasury.connect(user2).transferEth(user1.address, 10)).to.be.revertedWith(
      'RESTRICTED'
    );

    await expect(treasury.connect(user2).claimRewardsForTreasury()).to.be.revertedWith(
      'RESTRICTED'
    );
  });

  it('allowance and transfer', async () => {
    await agf.mintReward(treasury.address, 10, false);

    expect(await agf.allowance(treasury.address, user2.address)).eq(0);
    await treasury.connect(user1).approve(agf.address, user2.address, 10);
    expect(await agf.allowance(treasury.address, user2.address)).eq(10);

    expect(await agf.balanceOf(user2.address)).eq(0);
    expect(await agf.balanceOf(treasury.address)).eq(10);
    await treasury.connect(user1).transfer(agf.address, user2.address, 10);
    expect(await agf.balanceOf(user2.address)).eq(10);
    expect(await agf.balanceOf(treasury.address)).eq(0);
  });

  it('auto-claim on transfer', async () => {
    mineTicks(11); // make sure to produce AGF by the pool

    expect(await agf.balanceOf(user2.address)).eq(0);
    expect(await agf.balanceOf(treasury.address)).eq(0);
    await treasury.connect(user1).transfer(agf.address, user2.address, 10);
    expect(await agf.balanceOf(user2.address)).eq(10);
    expect(await agf.balanceOf(treasury.address)).gt(0);
  });
});
