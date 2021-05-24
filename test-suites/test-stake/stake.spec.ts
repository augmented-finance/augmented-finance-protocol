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
  stakingCooldownBlocks,
  stakingUnstakeBlocks,
} from '../../tasks/migrations/defaultTestDeployConfig';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumberish } from 'ethers';
import { tEthereumAddress } from './helpers/types';
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
  let blkAfterDeploy;
  const defaultStkAmount = 100;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2, slasher] = await ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    rc = await getRewardFreezer();

    AG = await getAGTokenByName('agDAI');
    xAG = await getMockStakedAgToken();
    rpAG = await getTokenWeightedRewardPoolAG();

    AGF = await getMockAgfToken();
    xAGF = await getMockStakedAgfToken();
    rpAGF = await getTokenWeightedRewardPoolAGF();

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

  const printBalances = async (s: SignerWithAddress) => {
    console.log(
      `balances of ${s.address}
xAGFBalance: ${await xAGF.balanceOf(s.address)}
AGFBalance: ${await AGF.balanceOf(s.address)}`
    );
  };

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

  it('can not redeem when paused', async () => {
    await xAGF.connect(root).setPaused(true);
    await stake(user1, defaultStkAmount);
    await expect(xAGF.connect(user1).redeem(user1.address, defaultStkAmount)).to.be.revertedWith(
      'STK_REDEEM_PAUSED',
    );
  });

  it('can redeem before unstake', async () => {
    await stake(user1, defaultStkAmount);
    await xAGF.connect(user1).redeem(user1.address, defaultStkAmount);
    expect(await xAGF.balanceOf(user1.address)).to.eq(0);
    expect(await AGF.balanceOf(user1.address)).to.eq(defaultStkAmount);
  });

  // tslint:disable-next-line:max-line-length
  it.skip('call from another account can not redeem if not enough balance to be burned', async () => {
    await stake(user1, defaultStkAmount);
    await printBalances(user1);
    // TODO: revert here?!
    await xAGF.connect(user2).redeemUnderlying(user1.address, defaultStkAmount);
    await printBalances(user1);
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
    await mineToBlock((await currentBlock()) + stakingCooldownBlocks);
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
