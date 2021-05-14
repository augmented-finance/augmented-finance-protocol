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
import { mineToBlock } from './utils';
import { HALF_RAY, ONE_ADDRESS, PERC_100, RAY } from '../../helpers/constants';
import { createRandomAddress } from '../../helpers/misc-utils';

chai.use(solidity);
const { expect } = chai;

describe('Zombie rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let zrp: ZombieRewardPool;
  let rc: RewardFreezer;
  let agf: MockAgfToken;
  let teamRewardInitialRate: string = RAY;
  let teamRewardsFreezePercentage = 0;
  let zombieRewardLimit = 5000;
  // TODO: needed for override
  let overrideStubVar = 0;
  let defaultReward = 2000;

  before(async () => {
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    [root, user1, user2] = await ethers.getSigners();
    await rawBRE.run('dev:agf-rewards', {
      teamRewardInitialRate: teamRewardInitialRate,
      teamRewardBaselinePercentage: 0,
      teamRewardUnlockBlock: 1000,
      teamRewardsFreezePercentage: teamRewardsFreezePercentage,
      zombieRewardLimit: zombieRewardLimit,
    });
    rc = await getRewardFreezer();
    zrp = await getZombieRewardPool();
    agf = await getMockAgfToken();
  });

  // it.only('can pause reward controller', async () => {
  //   await rc.connect(root).setPaused(true);
  //   await rc.connect(user1).claimReward();
  //   await expect(rc.connect(user1).claimReward()).to.be.revertedWith('abc');
  // });
});
