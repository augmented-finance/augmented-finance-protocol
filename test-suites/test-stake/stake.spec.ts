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
import { CFG, stakingCooldownBlocks, stakingUnstakeBlocks } from '../../tasks/migrations/defaultTestDeployConfig';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumberish } from 'ethers';
import { tEthereumAddress } from './helpers/types';
import { VL_INVALID_AMOUNT } from '../../helpers/contract_errors';

chai.use(solidity);
const { expect } = chai;

describe('Team rewards suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let rpAGF: TokenWeightedRewardPool;
  let rpAG: TokenWeightedRewardPool;
  let rc: RewardFreezer;
  let AGF: MockAgfToken;
  let xAGF: MockStakedAgfToken;
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
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGF();

    AG = await getAGTokenByName('agDAI');
    stkAG = await getMockStakedAgToken();
    rpAG = await getTokenWeightedRewardPoolAG();
    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const stake = async (s: SignerWithAddress, amount: BigNumberish) => {
    await AGF.connect(root).mintReward(s.address, amount);
    await AGF.connect(s).approve(xAGF.address, amount);
    await xAGF.connect(s).stake(s.address, amount);
  };

  const printBalances = async () => {
    console.log(
      `balances
xAGFBalance: ${await xAGF.balanceOf(user1.address)}
AGFBalance: ${await AGF.balanceOf(user1.address)}`
    );
  };

  it('can not call cooldown if not staking', async () => {
    await expect(xAGF.cooldown()).to.be.revertedWith('STK_INVALID_BALANCE_ON_COOLDOWN');
  });

  it('can not redeem when after unstake block has passed', async () => {
    await stake(user1, defaultStkAmount);
    await mineToBlock(stakingUnstakeBlocks + 10);
    await expect(xAGF.redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      'STK_UNSTAKE_WINDOW_FINISHED',
    );
  });

  it('can stake AGF and receive xAGF', async () => {
    await stake(user1, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
  });

  it('error when redeeming if amount is zero', async () => {
    await expect(xAGF.redeem(user1.address, 0)).to.be.revertedWith(VL_INVALID_AMOUNT);
  });

  it.skip('test paused', async () => {
    // Transaction reverted: function selector was not recognized and there's no fallback function
    await xAGF.connect(root).setPaused(true);
    // await stake(user1, defaultStkAmount);
  });

  it('can redeem before unstake', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });
});
