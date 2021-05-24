import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';

import {
  getAGTokenByName,
  getMockAgfToken,
  getMockStakedAgfToken,
  getMockStakedAgToken,
  getRewardFreezer,
  getTokenWeightedRewardPoolAG,
  getTokenWeightedRewardPoolAGF,
} from '../../helpers/contracts-getters';

import {
  DepositToken,
  MockAgfToken,
  MockStakedAgfToken,
  RewardFreezer,
  TokenWeightedRewardPool,
} from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { currentBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let rpAGF: TokenWeightedRewardPool;
  let rpAG: TokenWeightedRewardPool;
  let rc: RewardFreezer;
  let AGF: MockAgfToken;
  let stkAGF: MockStakedAgfToken;
  let AG: DepositToken;
  let stkAG: MockStakedAgfToken;
  let blkBeforeDeploy;
  let blkAfterDeploy;
  const defaultStkAmount = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardFreezer();

    AGF = await getMockAgfToken();
    stkAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGF();

    AG = await getAGTokenByName('agDAI');
    stkAG = await getMockStakedAgToken();
    rpAG = await getTokenWeightedRewardPoolAG();
    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('stake tokens', async () => {
    await AGF.connect(root).mintReward(user1.address, defaultStkAmount);
    console.log(`balance AGF: ${await AGF.balanceOf(user1.address)}`);
    await AGF.connect(user1).approve(stkAGF.address, defaultStkAmount);
    await stkAGF.connect(user1).stake(user1.address, defaultStkAmount);
    console.log(`balance stkAGF: ${await stkAGF.balanceOf(user1.address)}`);
    console.log(`balance AGF: ${await AGF.balanceOf(user1.address)}`);
  });
});
