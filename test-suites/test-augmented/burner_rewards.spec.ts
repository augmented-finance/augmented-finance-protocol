import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import rawBRE from 'hardhat';

import { getMockAgfToken, getPermitFreezerRewardPool, getMockRewardFreezer } from '../../helpers/contracts-getters';

import { MockAgfToken, RewardFreezer } from '../../types';
import { ONE_ADDRESS } from '../../helpers/constants';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import { revertSnapshot, takeSnapshot } from './utils';
import { getSigners } from '../../helpers/misc-utils';

chai.use(solidity);
const { expect } = chai;

// makeSuite('Rewards test suite', (testEnv: TestEnv) => {
describe('Rewards test suite', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let otherUsers: SignerWithAddress[];

  let rewardCtl: RewardFreezer;
  let agf: MockAgfToken;

  let blkBeforeDeploy;

  before(async () => {
    await rawBRE.run('set-DRE');
    await rawBRE.run('augmented:test-local', CFG);

    [deployer, user, user2, ...otherUsers] = await getSigners();

    // TODO each test below needs a separate freezer
    rewardCtl = await getMockRewardFreezer();
    expect(rewardCtl.address).to.properAddress;

    const freezer = await getPermitFreezerRewardPool();
    // deployer.address is used instead of a token contract
    // await rewardCtl.addRewardProvider(
    //   freezer.address,
    //   deployer.address,
    //   ONE_ADDRESS
    // );
    await rewardCtl.setFreezePercentage(0);

    agf = await getMockAgfToken();
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it.skip('Should claim reward', async () => {
    const freezer = await getPermitFreezerRewardPool();

    expect(await agf.balanceOf(user.address)).to.eq(0);

    await freezer.handleBalanceUpdate(ONE_ADDRESS, user.address, 0, 2000, 100000); // block 10
    await (await rewardCtl.connect(user).claimReward()).wait(1); // block 11
    expect(await agf.balanceOf(user.address)).to.eq(2000);

    await expect(rewardCtl.connect(user).claimReward())
      .to.emit(rewardCtl, 'RewardsClaimed')
      .withArgs(user.address, user.address, 2000); // block 12
    expect(await agf.balanceOf(user.address)).to.eq(4000);

    await rewardCtl.setFreezePercentage(5000); // set 50% // block 13

    await (await rewardCtl.connect(user).claimReward()).wait(1); // block 14
    // +50% of 4k for blocks 13-14, ttl frozen 2k
    expect(await agf.balanceOf(user.address)).to.eq(6000);

    await (await rewardCtl.connect(user).claimReward()).wait(1); // block 15
    expect(await agf.balanceOf(user.address)).to.eq(7000); // +50% of 2k for block 14, ttl frozen 3k

    await (await rewardCtl.connect(user).claimReward()).wait(1); // block 16
    expect(await agf.balanceOf(user.address)).to.eq(8000); // +50% of 2k for block 15, ttl frozen 4k

    // immediate meltdown
    await (await rewardCtl.setMeltDownAt(1)).wait(1); // block 18
    // 9000: +50% of 2k for block 18, ttl frozen 5k

    await (await freezer.handleBalanceUpdate(ONE_ADDRESS, user.address, 2000, 10000, 100000)).wait(1); // block 19
    // 11000: +2k for block 19, ttl ex-frozen 5k

    await (await rewardCtl.connect(user).claimReward()).wait(1); // block 20
    expect(await agf.balanceOf(user.address)).to.eq(26000); // = 10k for block 20 + 11000 + ex-frozen 5k

    // todo gradual meltdown
  });
});
