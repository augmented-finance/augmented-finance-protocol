import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import rawBRE, { ethers } from 'hardhat';

import { getLinearUnweightedRewardPool, getRewardFreezer } from '../../helpers/contracts-getters';
import { RewardFreezer } from '../../types';

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

  it('Should do something', async () => {
    rewardFreezer = await getRewardFreezer();
    expect(rewardFreezer.address).to.properAddress;

    const linearUnweightedRewardPool = await getLinearUnweightedRewardPool();
    await linearUnweightedRewardPool.addRewardProvider(deployer.address); // instead token contract
    await linearUnweightedRewardPool.setRate('1000000000000000000000000000');

    await (await rewardFreezer.admin_setFreezePortion(0)).wait(1);

    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 10, 20, 100);


    const tx = await rewardFreezer.claimReward();
    expect(tx.value).to.eq(0);
  });
});
