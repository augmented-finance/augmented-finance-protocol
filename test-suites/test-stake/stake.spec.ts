import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import {
  getAGTokenByName,
  getMockAgfToken,
  getMockStakedAgfToken,
  getMockStakedAgToken,
} from '../../helpers/contracts-getters';

import {
  DepositToken,
  MockAgfToken,
  MockStakedAgfToken,
} from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  CFG,
  slashingDefaultPercentageHR,
  stakingCooldownTicks,
  stakingUnstakeTicks,
} from '../../tasks/migrations/defaultTestDeployConfig';
import { mineTicks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumberish } from 'ethers';
import { ProtocolErrors } from '../../helpers/types';
import { MAX_UINT_AMOUNT, oneRay, RAY } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Staking', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let slasher: SignerWithAddress;
  let AGF: MockAgfToken;
  let xAGF: MockStakedAgfToken;
  let AG: DepositToken;
  let xAG: MockStakedAgfToken;
  let blkBeforeDeploy;
  const defaultStkAmount = 100;

  before(async () => {
    await rawBRE.run('augmented:test-local-staking', CFG);
    [root, user1, user2, slasher] = await (<any>rawBRE).ethers.getSigners();
    AG = await getAGTokenByName('agDAI');
    xAG = await getMockStakedAgToken();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const stake = async (s: SignerWithAddress, amount: BigNumberish) => {
    await AGF.connect(root).mintReward(s.address, amount, false);
    await AGF.connect(s).approve(xAGF.address, amount);
    await xAGF.connect(s).stake(s.address, amount, 0);
  };

  it('can not redeem after the unstake window has passed', async () => {
    console.log(`user address: ${user1.address}`);
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await mineTicks(stakingUnstakeTicks + stakingCooldownTicks + 1);
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_UNSTAKE_WINDOW_FINISHED
    );
  });

  it('can stake AGF and receive xAGF', async () => {
    await stake(user1, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await AGF.balanceOf(user1.address)).to.eq(0);
    expect(await xAGF.totalSupply()).to.eq(defaultStkAmount);
  });

  it('revert when redeem amount is zero', async () => {
    await expect(xAGF.connect(user1).redeem(user1.address, 0)).to.be.revertedWith(
      ProtocolErrors.VL_INVALID_AMOUNT
    );
  });

  it('can stake but not redeem when not redeemable', async () => {
    expect(await xAGF.isRedeemable()).eq(true);
    await xAGF.connect(slasher).setRedeemable(false);
    expect(await xAGF.isRedeemable()).eq(false);
    await stake(user1, defaultStkAmount);
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_REDEEM_PAUSED
    );
    await expect(xAGF.connect(user1).redeemUnderlying(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_REDEEM_PAUSED
    );
  });

  it('can not stake or redeem when paused', async () => {
    expect(await xAGF.isPaused()).eq(false);
    expect(await xAGF.isRedeemable()).eq(true);
    await xAGF.connect(root).setPaused(true);
    expect(await xAGF.isPaused()).eq(true);
    expect(await xAGF.isRedeemable()).eq(false);

    await expect(xAGF.connect(user1).stake(user1.address, defaultStkAmount, 0)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
    await expect(xAGF.connect(user1).redeemUnderlying(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
  });


  it('can redeem max', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount);
  });

  it('can redeem max underlying', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(user2).redeemUnderlying(user2.address, MAX_UINT_AMOUNT);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount);
  });

  it('revert excessive redeem', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    await expect(xAGF.connect(user2).redeem(user2.address, defaultStkAmount + 1)).to.be.revertedWith(
      'amount exceeds balance'
    );
  });

  it('revert excessive redeem underlying', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    await expect(xAGF.connect(user2).redeemUnderlying(user2.address, defaultStkAmount + 1)).to.be.revertedWith(
      'amount exceeds balance'
    );
  });

  it('can redeem from user2 to user1', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(user2).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('can redeem underlying from user2 to user1', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(user2).redeemUnderlying(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('cooldown reverts when nothing was staked', async () => {
    await expect(xAGF.cooldown()).to.be.revertedWith(ProtocolErrors.STK_INVALID_BALANCE_ON_COOLDOWN);
  });

  it('can redeem within the unstake window only', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).cooldown();
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_INSUFFICIENT_COOLDOWN
    );
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await xAGF.totalSupply()).to.eq(0);
  });

  it('set incorrect slash percentage', async () => {
    await expect(xAGF.connect(root).setMaxSlashablePercentage(-1)).to.be.reverted;
    await expect(xAGF.connect(root).setMaxSlashablePercentage(10001)).to.be.revertedWith(
      ProtocolErrors.STK_EXCESSIVE_SLASH_PCT
    );
  });

  it('can slash underlying', async () => {
    expect(await xAGF.exchangeRate()).to.eq(RAY);
    await stake(user1, defaultStkAmount);
    expect(await xAGF.exchangeRate()).to.eq(RAY);

    await xAGF.connect(user1).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, 110);
    expect(await xAGF.exchangeRate()).to.eq(oneRay.multipliedBy(1-slashingDefaultPercentageHR).toFixed());

    const slashed = defaultStkAmount * slashingDefaultPercentageHR;
    expect(await AGF.balanceOf(slasher.address)).to.eq(slashed);
    expect(await AGF.balanceOf(xAGF.address)).to.eq(defaultStkAmount - slashed);
    expect(await xAGF.totalSupply()).to.eq(defaultStkAmount);
  });

  it('slash not less than minSlashAmount', async () => {
    await stake(user1, defaultStkAmount);
    const slashed = defaultStkAmount * slashingDefaultPercentageHR;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, slashed*2, slashed+100);
    expect(await AGF.balanceOf(slasher.address)).to.eq(0);
    expect(await AGF.balanceOf(xAGF.address)).to.eq(defaultStkAmount);
  });

  it('slash no more than maxSlashAmount', async () => {
    await stake(user1, defaultStkAmount);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, slashed);
    expect(await AGF.balanceOf(slasher.address)).to.eq(slashed);
    expect(await AGF.balanceOf(xAGF.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, slashed);

    await xAGF.connect(user2).redeem(user2.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem max after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, slashed);

    await xAGF.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem underlying after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, slashed);

    await expect(xAGF.connect(user2).redeemUnderlying(user2.address, defaultStkAmount)).to.be.revertedWith(
      'amount exceeds balance'
    );

    await xAGF.connect(user2).redeemUnderlying(user2.address, defaultStkAmount - slashed);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem max underlying after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xAGF.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xAGF.connect(slasher).slashUnderlying(slasher.address, 1, slashed);

    await xAGF.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    expect(await AGF.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('transfer stake', async () => {
    await stake(user1, defaultStkAmount);

    expect(await xAGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await xAGF.balanceOf(user2.address)).to.eq(0);
    await xAGF.connect(user1).transfer(user2.address, defaultStkAmount / 2);

    expect(await xAGF.balanceOf(user1.address)).to.eq(defaultStkAmount / 2);
    expect(await xAGF.balanceOf(user2.address)).to.eq(defaultStkAmount / 2);
    expect(await xAGF.totalSupply()).to.eq(defaultStkAmount);
  });

  it('transfer all unsets cooldown for user1', async () => {
    await stake(user1, defaultStkAmount);

    expect(await xAGF.getCooldown(user1.address)).eq(0);
    expect(await xAGF.getCooldown(user2.address)).eq(0);

    await xAGF.connect(user1).cooldown();
    expect(await xAGF.getCooldown(user1.address)).gt(0);

    await xAGF.connect(user1).transfer(user2.address, defaultStkAmount);
    expect(await xAGF.getCooldown(user1.address)).eq(0);
    expect(await xAGF.getCooldown(user2.address)).eq(0);

    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await xAGF.balanceOf(user2.address)).to.eq(defaultStkAmount);
    expect(await xAGF.totalSupply()).to.eq(defaultStkAmount);
  });

  it('transfer from user1 to user2 where user2\'s cooldown is later than user1 keeps cooldown values', async () => {
    await stake(user1, defaultStkAmount);
    await stake(user2, defaultStkAmount);

    await xAGF.connect(user1).cooldown();
    const cooldown1 = await xAGF.getCooldown(user1.address);
    expect(await xAGF.getCooldown(user1.address)).gt(0);

    await xAGF.connect(user2).cooldown();
    const cooldown2 = await xAGF.getCooldown(user2.address);
    expect(cooldown2).gt(cooldown1);

    await xAGF.connect(user1).transfer(user2.address, defaultStkAmount / 2);
    expect(await xAGF.getCooldown(user1.address)).eq(cooldown1);
    expect(await xAGF.getCooldown(user2.address)).eq(cooldown2);
  });

  it('transfer from user2 to user1 where user2\'s cooldown is later than user1 increases user1\'s cooldown proportionally', async () => {
    await stake(user1, defaultStkAmount);
    await stake(user2, defaultStkAmount);

    await xAGF.connect(user1).cooldown();
    const cooldown1 = await xAGF.getCooldown(user1.address);
    expect(await xAGF.getCooldown(user1.address)).gt(0);

    await xAGF.connect(user2).cooldown();
    const cooldown2 = await xAGF.getCooldown(user2.address);
    expect(cooldown2).gt(cooldown1);

    await xAGF.connect(user2).transfer(user1.address, defaultStkAmount / 2);
    expect(await xAGF.getCooldown(user1.address)).eq(((cooldown1 + cooldown2) / 2) | 0);
    expect(await xAGF.getCooldown(user2.address)).eq(cooldown2);
  });
});
