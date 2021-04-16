import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import rawBRE, { ethers } from 'hardhat';

import { getLinearUnweightedRewardPool, getRewardFreezer } from '../../helpers/contracts-getters';
import { RewardFreezer } from '../../types';
import { increaseTimeAndMine } from '../test-stake/helpers/misc-utils';

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
    await linearUnweightedRewardPool.addRewardProvider(deployer.address); // instead token contract
    await linearUnweightedRewardPool.setRate(0x1ffffffffffff0);

    await rewardFreezer.admin_setFreezePortion(0);

    for(let i = 0 ; i< 100; i++) {
      await ethers.provider.send('evm_mine', []);
    }

    await linearUnweightedRewardPool.handleBalanceUpdate(deployer.address, 0, 2000, 100000);
    for(let i = 0 ; i< 100; i++) {
      await ethers.provider.send('evm_mine', []);
    }

    const tx = await rewardFreezer.claimReward();
    expect(tx.value).to.not.eq(0);
  });
});
