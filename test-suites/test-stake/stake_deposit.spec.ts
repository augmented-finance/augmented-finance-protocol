import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import {
  getAGTokenByName,
  getLendingPoolProxy,
  getMintableERC20,
  getMockDepositStakeToken,
} from '../../helpers/contracts-getters';

import {
  DepositToken,
  LendingPool,
  MintableERC20,
  MockDepositStakeToken,
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
import { HALF_WAD, MAX_UINT_AMOUNT, oneRay, RAY, WAD } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Stake agToken', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let slasher: SignerWithAddress;
  let baseToken: MintableERC20;
  let pool: LendingPool;
  let token: DepositToken;
  let xToken: MockDepositStakeToken;
  let blkBeforeDeploy;
  const defaultStkAmount = 100;

  before(async () => {
    await rawBRE.run('augmented:test-local-staking', CFG);
    let user3: SignerWithAddress;
    [root, user1, user2, slasher, user3] = await (<any>rawBRE).ethers.getSigners();
    
    token = await getAGTokenByName('agDAI');
    pool = await getLendingPoolProxy(await token.POOL());
    xToken = await getMockDepositStakeToken();
    baseToken = await getMintableERC20(await token.UNDERLYING_ASSET_ADDRESS());

    {
      console.log('Initialize reserve index'); // force DAI reserve index to be more than RAY
      await baseToken.mint(WAD);
      await baseToken.approve(pool.address, WAD);
      await pool.deposit(baseToken.address, WAD, root.address, 0);
  
      const token2 = await getAGTokenByName('agUSDC');
      const baseToken2 = await getMintableERC20(await token2.UNDERLYING_ASSET_ADDRESS());
      await baseToken2.mint(WAD);
      await baseToken2.approve(pool.address, WAD);
      await pool.deposit(baseToken2.address, WAD, user3.address, 0);
      await pool.connect(user3).borrow(baseToken.address, HALF_WAD, 2 /* variable */, 0, user3.address);

      await mineTicks(10);

      await baseToken.mint(WAD);
      await baseToken.approve(pool.address, WAD);
      await pool.deposit(baseToken.address, WAD, root.address, 0);

      expect(await pool.getReserveNormalizedIncome(baseToken.address)).gt(RAY);
    }
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const stake = async (s: SignerWithAddress, amount: BigNumberish) => {
    await baseToken.mint(amount);
    await baseToken.approve(pool.address, amount);
    await pool.deposit(baseToken.address, amount, s.address, 0);
    await token.connect(s).approve(xToken.address, amount);
    await xToken.connect(s).stake(s.address, amount, 0);
  };

  it('can not redeem after the unstake window has passed', async () => {
    await stake(user1, defaultStkAmount);
    await xToken.connect(user1).cooldown();
    await mineTicks(stakingUnstakeTicks + stakingCooldownTicks + 1);
    await expect(xToken.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_UNSTAKE_WINDOW_FINISHED
    );
  });

  it('can stake token and receive xToken', async () => {
    await stake(user1, defaultStkAmount);
    expect(await xToken.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await xToken.balanceOfUnderlying(user1.address)).to.eq(defaultStkAmount);
    expect(await token.balanceOf(user1.address)).to.eq(0);
    expect(await xToken.totalSupply()).to.eq(defaultStkAmount);
  });

  it('revert when redeem amount is zero', async () => {
    await expect(xToken.connect(user1).redeem(user1.address, 0)).to.be.revertedWith(
      ProtocolErrors.VL_INVALID_AMOUNT
    );
  });

  it('can stake but not redeem when not redeemable', async () => {
    expect(await xToken.isRedeemable()).eq(true);
    await xToken.connect(slasher).setRedeemable(false);
    expect(await xToken.isRedeemable()).eq(false);
    await stake(user1, defaultStkAmount);
    await expect(xToken.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_REDEEM_PAUSED
    );
    await expect(xToken.connect(user1).redeemUnderlying(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_REDEEM_PAUSED
    );
  });

  it('can not stake or redeem when paused', async () => {
    expect(await xToken.isPaused()).eq(false);
    expect(await xToken.isRedeemable()).eq(true);
    await xToken.connect(root).setPaused(true);
    expect(await xToken.isPaused()).eq(true);
    expect(await xToken.isRedeemable()).eq(false);

    await expect(xToken.connect(user1).stake(user1.address, defaultStkAmount, 0)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
    await expect(xToken.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
    await expect(xToken.connect(user1).redeemUnderlying(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_PAUSED
    );
  });

  it('can redeem max', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await xToken.balanceOfUnderlying(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount);
  });

  it('can redeem max underlying', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(user2).redeemUnderlying(user2.address, MAX_UINT_AMOUNT);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await xToken.balanceOfUnderlying(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount);
  });

  it('revert excessive redeem', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    await expect(xToken.connect(user2).redeem(user2.address, defaultStkAmount + 1)).to.be.revertedWith(
      'amount exceeds balance'
    );
  });

  it('revert excessive redeem underlying', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    await expect(xToken.connect(user2).redeemUnderlying(user2.address, defaultStkAmount + 1)).to.be.revertedWith(
      'amount exceeds balance'
    );
  });

  it('can redeem from user2 to user1', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(user2).redeem(user1.address, defaultStkAmount);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('can redeem underlying from user2 to user1', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(user2).redeemUnderlying(user1.address, defaultStkAmount);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  it('cooldown reverts when nothing was staked', async () => {
    await expect(xToken.cooldown()).to.be.revertedWith(ProtocolErrors.STK_INVALID_BALANCE_ON_COOLDOWN);
  });

  it('can redeem within the unstake window only', async () => {
    await stake(user1, defaultStkAmount);
    await xToken.connect(user1).cooldown();
    await expect(xToken.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      ProtocolErrors.STK_INSUFFICIENT_COOLDOWN
    );
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xToken.balanceOf(user1.address)).to.eq(0);
    expect(await token.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await xToken.totalSupply()).to.eq(0);
  });

  it('set incorrect slash percentage', async () => {
    await expect(xToken.connect(root).setMaxSlashablePercentage(-1)).to.be.reverted;
    await expect(xToken.connect(root).setMaxSlashablePercentage(10001)).to.be.revertedWith(
      ProtocolErrors.STK_EXCESSIVE_SLASH_PCT
    );
  });

  it('initial exchange rate is same as reserve index', async () => {
    expect(await xToken.exchangeRate()).to.eq(await pool.getReserveNormalizedIncome(baseToken.address));
  });

  it('can slash underlying', async () => {
    await stake(user1, defaultStkAmount);
    expect(await xToken.exchangeRate()).to.eq(await pool.getReserveNormalizedIncome(baseToken.address));
    expect(await xToken.balanceOfUnderlying(user1.address)).to.eq(defaultStkAmount);

    await xToken.connect(user1).cooldown();
    await mineTicks(stakingCooldownTicks);
    await xToken.connect(slasher).slashUnderlying(token.address, 1, 110);

    const baseRate = await pool.getReserveNormalizedIncome(baseToken.address);
    const expectedRate = baseRate.mul(oneRay.multipliedBy(1-slashingDefaultPercentageHR).toFixed()).div(RAY);
    expect(await xToken.exchangeRate()).to.eq(expectedRate);
    expect(await xToken.totalSupply()).to.eq(defaultStkAmount);
    expect(await xToken.balanceOf(user1.address)).eq(defaultStkAmount);
    
    const slashed = defaultStkAmount * slashingDefaultPercentageHR;
    expect(await xToken.balanceOfUnderlying(user1.address)).eq(defaultStkAmount - slashed);
  });

  it('slash not less than minSlashAmount', async () => {
    await stake(user1, defaultStkAmount);
    const slashed = defaultStkAmount * slashingDefaultPercentageHR;
    await xToken.connect(slasher).slashUnderlying(token.address, slashed*2, slashed+100);
    expect(await xToken.balanceOfUnderlying(user1.address)).eq(defaultStkAmount);
  });

  it('slash no more than maxSlashAmount', async () => {
    await stake(user1, defaultStkAmount);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xToken.connect(slasher).slashUnderlying(token.address, 1, slashed);
    expect(await xToken.balanceOfUnderlying(user1.address)).eq(defaultStkAmount - slashed);
  });

  it('can redeem after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xToken.connect(slasher).slashUnderlying(token.address, 1, slashed);

    await xToken.connect(user2).redeem(user2.address, defaultStkAmount);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem max after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xToken.connect(slasher).slashUnderlying(token.address, 1, slashed);

    await xToken.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem underlying after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xToken.connect(slasher).slashUnderlying(token.address, 1, slashed);

    await expect(xToken.connect(user2).redeemUnderlying(user2.address, defaultStkAmount)).to.be.revertedWith(
      'amount exceeds balance'
    );

    await xToken.connect(user2).redeemUnderlying(user2.address, defaultStkAmount - slashed);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('can redeem max underlying after slash', async () => {
    await stake(user2, defaultStkAmount);
    await xToken.connect(user2).cooldown();
    await mineTicks(stakingCooldownTicks);

    const slashed = (defaultStkAmount * slashingDefaultPercentageHR) / 2;
    await xToken.connect(slasher).slashUnderlying(token.address, 1, slashed);

    await xToken.connect(user2).redeem(user2.address, MAX_UINT_AMOUNT);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    expect(await token.balanceOf(user2.address)).to.eq(defaultStkAmount - slashed);
  });

  it('transfer stake', async () => {
    await stake(user1, defaultStkAmount);

    expect(await xToken.balanceOf(user1.address)).to.eq(defaultStkAmount);
    expect(await xToken.balanceOf(user2.address)).to.eq(0);
    await xToken.connect(user1).transfer(user2.address, defaultStkAmount / 2);

    expect(await xToken.balanceOf(user1.address)).to.eq(defaultStkAmount / 2);
    expect(await xToken.balanceOf(user2.address)).to.eq(defaultStkAmount / 2);
    expect(await xToken.totalSupply()).to.eq(defaultStkAmount);
  });

  it('transfer all unsets cooldown for user1', async () => {
    await stake(user1, defaultStkAmount);

    expect(await xToken.getCooldown(user1.address)).eq(0);
    expect(await xToken.getCooldown(user2.address)).eq(0);

    await xToken.connect(user1).cooldown();
    expect(await xToken.getCooldown(user1.address)).gt(0);

    await xToken.connect(user1).transfer(user2.address, defaultStkAmount);
    expect(await xToken.getCooldown(user1.address)).eq(0);
    expect(await xToken.getCooldown(user2.address)).eq(0);

    expect(await xToken.balanceOf(user1.address)).to.eq(0);
    expect(await xToken.balanceOf(user2.address)).to.eq(defaultStkAmount);
    expect(await xToken.totalSupply()).to.eq(defaultStkAmount);
  });

  it('transfer from user1 to user2 where user2\'s cooldown is later than user1 keeps cooldown values', async () => {
    await stake(user1, defaultStkAmount);
    await stake(user2, defaultStkAmount);

    await xToken.connect(user1).cooldown();
    const cooldown1 = await xToken.getCooldown(user1.address);
    expect(await xToken.getCooldown(user1.address)).gt(0);

    await xToken.connect(user2).cooldown();
    const cooldown2 = await xToken.getCooldown(user2.address);
    expect(cooldown2).gt(cooldown1);

    await xToken.connect(user1).transfer(user2.address, defaultStkAmount / 2);
    expect(await xToken.getCooldown(user1.address)).eq(cooldown1);
    expect(await xToken.getCooldown(user2.address)).eq(cooldown2);
  });

  it('transfer from user2 to user1 where user2\'s cooldown is later than user1 increases user1\'s cooldown proportionally', async () => {
    await stake(user1, defaultStkAmount);
    await stake(user2, defaultStkAmount);

    await xToken.connect(user1).cooldown();
    const cooldown1 = await xToken.getCooldown(user1.address);
    expect(await xToken.getCooldown(user1.address)).gt(0);

    await xToken.connect(user2).cooldown();
    const cooldown2 = await xToken.getCooldown(user2.address);
    expect(cooldown2).gt(cooldown1);

    await xToken.connect(user2).transfer(user1.address, defaultStkAmount / 2);
    expect(await xToken.getCooldown(user1.address)).eq(((cooldown1 + cooldown2) / 2) | 0);
    expect(await xToken.getCooldown(user2.address)).eq(cooldown2);
  });
});
