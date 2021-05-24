import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getMockAgfToken,
  getRewardFreezer,
  getZombieRewardPool,
} from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer, ZombieRewardPool } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { RAY } from '../../helpers/constants';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

describe('Augmented pausable suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let zrp: ZombieRewardPool;
  let rc: RewardFreezer;
  let agf: MockAgfToken;

  beforeEach(async () => {
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardFreezer();
    zrp = await getZombieRewardPool();
    agf = await getMockAgfToken();
  });

  it('can pause/unpause reward controller', async () => {
    await rc.connect(root).setPaused(true);
    await expect(rc.connect(user1).claimReward()).to.be.revertedWith('rewards are paused');
    await rc.connect(root).setPaused(false);
    await rc.connect(user1).claimReward();
  });
});
