import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { waitForTx } from '../../helpers/misc-utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import rawBRE, { ethers } from 'hardhat';

import {
  getAgfToken,
  getMockAgfToken,
  getLinearUnweightedRewardPool,
  getRewardFreezer,
} from '../../helpers/contracts-getters';

import { RewardFreezer } from '../../types';
import { RAY } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

// makeSuite('Rewards test suite', (testEnv: TestEnv) => {
describe('Migrator test suite', () => {
  // const { deployer, users } = testEnv;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let otherUsers: SignerWithAddress[];

  let rewardFreezer: RewardFreezer;

  before(async () => {
    await rawBRE.run('set-DRE');
    await rawBRE.run('dev:augmented-access');
    await rawBRE.run('dev:agf-rewards');

    [deployer, user, ...otherUsers] = await ethers.getSigners();
    console.log(`Admin address: ${deployer.address}`);
    console.log(`User address: ${user.address}`);
  });

  it('Should claim reward > 0', async () => {
    rewardFreezer = await getRewardFreezer();
    expect(rewardFreezer.address).to.properAddress;

    const linearUnweightedRewardPool = await getLinearUnweightedRewardPool();
    // deployer.address is used instead of a token contract
    await rewardFreezer.admin_addRewardProvider(linearUnweightedRewardPool.address, deployer.address);
    await rewardFreezer.admin_setFreezePercentage(0);

    const agf = await getMockAgfToken();
    expect(await agf.balanceOf(user.address)).to.eq(0);

    await linearUnweightedRewardPool.handleBalanceUpdate(user.address, 0, 2000, 100000); // block 10
    await (await rewardFreezer.connect(user).claimReward()).wait(1); // block 11
    expect(await agf.balanceOf(user.address)).to.eq(2000);

    await expect(rewardFreezer.connect(user).claimReward()).to.emit(rewardFreezer, 'RewardsClaimed').withArgs(user.address, user.address, 2000); // block 12
    expect(await agf.balanceOf(user.address)).to.eq(4000);

    await rewardFreezer.admin_setFreezePercentage(5000); // set 50% // block 13

    await (await rewardFreezer.connect(user).claimReward()).wait(1); // block 14
    expect(await agf.balanceOf(user.address)).to.eq(6000); // +50% of 4k for blocks 13-14, ttl frozen 2k

    await (await rewardFreezer.connect(user).claimReward()).wait(1); // block 15
    expect(await agf.balanceOf(user.address)).to.eq(7000); // +50% of 2k for block 14, ttl frozen 3k

    await (await rewardFreezer.connect(user).claimReward()).wait(1); // block 16
    expect(await agf.balanceOf(user.address)).to.eq(8000); // +50% of 2k for block 15, ttl frozen 4k

    // immediate meltdown
    await (await rewardFreezer.admin_setMeltDownBlock(1)).wait(1);   // block 17
    await (await rewardFreezer.connect(user).claimReward()).wait(1); // block 18
    expect(await agf.balanceOf(user.address)).to.eq(16000); // + 4k for blocks 17-18 and frozen 4k

    // todo gradual meltdown
  });
});
