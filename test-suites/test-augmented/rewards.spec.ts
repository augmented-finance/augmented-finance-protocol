import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import rawBRE, { ethers } from 'hardhat';

import {
  getAgfToken,
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
    // in test deployer.address is used instead of token contract
    await linearUnweightedRewardPool.addRewardProvider(deployer.address);
    await linearUnweightedRewardPool.setRate(RAY);

    await rewardFreezer.admin_setFreezePercentage(1);

    const tx = await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 0, 2000, 100000);
    await tx.wait(1);
    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);

    await rewardFreezer.claimRewardOnBehalf(deployer.address);
    await rewardFreezer.claimRewardOnBehalf(deployer.address);
    await rewardFreezer.claimRewardOnBehalf(deployer.address);
    await rewardFreezer.claimRewardOnBehalf(deployer.address);
    await rewardFreezer.claimRewardOnBehalf(deployer.address);

    const agf = await getAgfToken();
    const balance = await agf.balanceOf(deployer.address);

    expect(balance).to.eq(2000);
  });
});
