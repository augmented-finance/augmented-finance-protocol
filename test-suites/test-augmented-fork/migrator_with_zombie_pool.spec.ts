import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import { DepositToken, Migrator, MintableERC20, MockAgfToken, RewardFreezer, ZombieAdapter } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getMigrator,
  getMintableERC20,
  getMockAgfToken,
  getRewardFreezer,
  getZombieAdapter,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '../test-augmented/helpers/make-suite';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { defaultMigrationAmount, defaultReferral, impersonateAndGetSigner } from './helper';
import { revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import {
  CFG,
  ZTOKEN_ADDRESS,
  zombieWhaleONE,
} from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (Zombie adapter + ZombieRewardPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let zAdapter: ZombieAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let user1: SignerWithAddress;
  let zombieTokenContract: MintableERC20;
  let zombieWhale: Provider | Signer | string;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [ZTOKEN_ADDRESS],
    });
    zombieTokenContract = await getMintableERC20(ZTOKEN_ADDRESS);
    zombieWhale = await impersonateAndGetSigner(zombieWhaleONE);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    await rawBRE.run('augmented:test-local', CFG);
    zAdapter = await getZombieAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  // TODO: add bound cases for partial migration

  it('can not sweep tokens from adapter before migration', async () => {
    const toAddress = zAdapter.address;
    await zombieTokenContract.connect(zombieWhale).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await zombieTokenContract.connect(zombieWhale).balanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(root).sweepToken(toAddress, zombieTokenContract.address, zombieWhaleONE)
    ).to.be.revertedWith('origin and underlying can only be swept after migration');
  });

  it('can sweep tokens from migrator back', async () => {
    let wb = await zombieTokenContract.balanceOf(zombieWhaleONE);
    const toAddress = m.address;
    await zombieTokenContract.connect(zombieWhale).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await zombieTokenContract
      .connect(zombieWhale)
      .balanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await m.connect(root).sweepToken(toAddress, zombieTokenContract.address, zombieWhaleONE);
    const migratoraDaiBalanceAfterSweep = await zombieTokenContract
      .connect(zombieWhale)
      .balanceOf(toAddress);
    expect(migratoraDaiBalanceAfterSweep).to.eq(0);
    const wa = await zombieTokenContract.balanceOf(zombieWhaleONE);
    expect(wb).to.eq(wa);
  });

  it('withdraw is not allowed with ZombieRewardPool', async () => {
    await zombieTokenContract.connect(zombieWhale).approve(m.address, defaultMigrationAmount);
    await m
      .connect(zombieWhale)
      .depositToMigrate(ZTOKEN_ADDRESS, defaultMigrationAmount, defaultReferral);
    await rc.connect(zombieWhale).claimReward();
    expect(await agf.balanceOf(zombieWhaleONE)).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(zombieWhale).withdrawFromMigrate(ZTOKEN_ADDRESS, defaultMigrationAmount)
    ).to.be.revertedWith('balance reduction is not allowed by the reward pool');
  });

  it.skip('can not claim if claims are not enabled for adapter', async () => {
    // no claim required for ZombieRewardPool, migrating automatically after depositToMigrate
  });

  it('can not deposit to migrate when approved amount is not enough', async () => {
    let whaleBeforeAmount = await zombieTokenContract.balanceOf(zombieWhaleONE);
    console.log(`whale before: ${whaleBeforeAmount}`);
    await zombieTokenContract.connect(zombieWhale).approve(m.address, 1);

    await expect(
      m
        .connect(zombieWhale)
        .depositToMigrate(zombieTokenContract.address, defaultMigrationAmount, defaultReferral)
    ).to.be.revertedWith('SafeERC20: low-level call failed');
  });

  it('deposit and migrate aDai, claim both rewards', async () => {
    // at block 12419283, see hardhat fork config
    let wb = await zombieTokenContract.balanceOf(zombieWhaleONE);

    await zombieTokenContract.connect(zombieWhale).approve(m.address, defaultMigrationAmount);
    await m
      .connect(zombieWhale)
      .depositToMigrate(ZTOKEN_ADDRESS, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(ZTOKEN_ADDRESS, zombieWhaleONE);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.connect(zombieWhale).claimAllMigrated();

    await rc.connect(zombieWhale).claimReward();
    expect(await agf.balanceOf(zombieWhaleONE)).to.eq(defaultMigrationAmount);

    const wa = await zombieTokenContract.balanceOf(zombieWhaleONE);
    // TODO: internalDeposit 962 instead of 1k aDai
    console.log(`diff: ${wb.sub(wa).toString()}`);
    // expect(wa).to.eq(wb);
  });
});
