import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import { getMockRewardFreezer } from '../../helpers/contracts-getters';

import { RewardFreezer } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { ProtocolErrors } from '../../helpers/types';
import { revertSnapshot, takeSnapshot } from './utils';

chai.use(solidity);
const { expect } = chai;

describe('Augmented pausable suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rc: RewardFreezer;
  let blkBeforeDeploy;

  before(async () => {
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getMockRewardFreezer();
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('can pause/unpause reward controller', async () => {
    await rc.connect(root).setPaused(true);
    await expect(rc.connect(user1).claimReward()).to.be.revertedWith(ProtocolErrors.RW_REWARD_PAUSED);
    await rc.connect(root).setPaused(false);
    await rc.connect(user1).claimReward();
  });
});
