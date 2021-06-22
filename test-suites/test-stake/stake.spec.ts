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
import {
  CFG,
  slashingDefaultPercentageHR,
  stakingCooldownTicks,
  stakingUnstakeTicks,
} from '../../tasks/migrations/defaultTestDeployConfig';
import { mineSeconds, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumberish } from 'ethers';
import { VL_INVALID_AMOUNT } from '../../helpers/contract_errors';

chai.use(solidity);
const { expect } = chai;

describe('Staking', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let slasher: SignerWithAddress;
  let rpAGF: TokenWeightedRewardPool;
  let rpAG: TokenWeightedRewardPool;
  let rc: RewardFreezer;
  let AGF: MockAgfToken;
  let xAGF: MockStakedAgfToken;
  let AG: DepositToken;
  let xAG: MockStakedAgfToken;
  let blkBeforeDeploy;
  const defaultStkAmount = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2, slasher] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local-staking', CFG);
    rc = await getRewardFreezer();

    AG = await getAGTokenByName('agDAI');
    xAG = await getMockStakedAgToken();
    rpAG = await getTokenWeightedRewardPoolAG();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGF();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const printBalances = async (s: SignerWithAddress) => {
    console.log(
      `balances of ${s.address}
xAGFBalance: ${await xAGF.balanceOf(s.address)}
AGFBalance: ${await AGF.balanceOf(s.address)}`
    );
  };

  const stake = async (s: SignerWithAddress, amount: BigNumberish) => {
    await AGF.connect(root).mintReward(s.address, amount, false);
    await AGF.connect(s).approve(xAGF.address, amount);
    await xAGF.connect(s).stake(s.address, amount);
  };

  it('can not redeem when after unstake block has passed', async () => {
    console.log(`user address: ${user1.address}`);
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await mineSeconds(stakingUnstakeTicks + stakingCooldownTicks + 1);
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      'STK_UNSTAKE_WINDOW_FINISHED'
    );
  });

  it('can stake AGF and receive xAGF', async () => {
    await stake(user1, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
  });

  it('error when redeeming if amount is zero', async () => {
    await expect(xAGF.connect(user1).redeem(user1.address, 0)).to.be.revertedWith(
      VL_INVALID_AMOUNT
    );
  });

  it('can not redeem when paused', async () => {
    await xAGF.connect(root).setPaused(true);
    await stake(user1, defaultStkAmount);
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      'STK_REDEEM_PAUSED'
    );
  });

  it('can redeem before unstake', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await mineSeconds(stakingCooldownTicks);
    await xAGF.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('can burn from another account when redeeming', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineSeconds(stakingCooldownTicks);
    await xAGF.connect(user2).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('error calling cooldown if not staking', async () => {
    await expect(xAGF.cooldown()).to.be.revertedWith('STK_INVALID_BALANCE_ON_COOLDOWN');
  });

  it('can set cooldown, and redeem afterwards', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      'STK_INSUFFICIENT_COOLDOWN'
    );
    await mineSeconds(stakingCooldownTicks);
    await xAGF.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('set slash incorrect percentage is reverted', async () => {
    await expect(xAGF.connect(root).setMaxSlashablePercentage(-1)).to.be.reverted;
    await expect(xAGF.connect(root).setMaxSlashablePercentage(10001)).to.be.revertedWith(
      'STK_EXCESSIVE_SLASH_PCT'
    );
  });

  it('can slash underlying', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await mineSeconds(stakingCooldownTicks);
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 10, 110);
    const slashed = defaultStkAmount * slashingDefaultPercentageHR;
    expect(await AGF.balanceOf(slasher.address)).to.eq(slashed);
    expect(await AGF.balanceOf(xAGF.address)).to.eq(defaultStkAmount - slashed);
  });

  it('slash no funds if underlying < minSlashAmount', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 150, 300);
    expect(await AGF.balanceOf(slasher.address)).to.eq(0);
    expect(await AGF.balanceOf(xAGF.address)).to.eq(defaultStkAmount);
  });
});
