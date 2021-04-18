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
import { increaseTimeAndMine } from '../test-stake/helpers/misc-utils';
import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
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
    await rawBRE.run('dev:agf-rewards');

    [deployer, user, ...otherUsers] = await ethers.getSigners();
    console.log(`Admin address: ${deployer.address}`);
    console.log(`User address: ${user.address}`);
  });

  it('Should claim reward > 0', async () => {
    rewardFreezer = await getRewardFreezer();
    expect(rewardFreezer.address).to.properAddress;

    const linearUnweightedRewardPool = await getLinearUnweightedRewardPool();
    await linearUnweightedRewardPool.addRewardProvider(deployer.address); // instead of token contract
    await linearUnweightedRewardPool.setRate(RAY);

    await rewardFreezer.admin_setFreezePortion(1);

    var tx = await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 0, 2000, 100000);
    await tx.wait(1);
    linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);
    linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 2000, 2000, 100000);

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
