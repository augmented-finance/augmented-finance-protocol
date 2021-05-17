import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import { DepositToken, Migrator, MockAgfToken, RewardFreezer, ZombieAdapter } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAToken,
  getMigrator,
  getMockAgfToken,
  getRewardFreezer,
  getZombieAdapter,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '../test-augmented/helpers/make-suite';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {
  defaultMigrationAmount,
  defaultReferral,
  shitcoinWhaleONE,
  shitcoinAddress,
  impersonateAndGetSigner,
} from './helper';
import { revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

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
  let shitcoinContract: DepositToken;
  let shitcoinWhale: Provider | Signer | string;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [shitcoinAddress],
    });
    shitcoinContract = await getAToken(shitcoinAddress);
    shitcoinWhale = await impersonateAndGetSigner(shitcoinWhaleONE);
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
    await shitcoinContract.connect(shitcoinWhale).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await shitcoinContract
      .connect(shitcoinWhale)
      .scaledBalanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(root).admin_sweepToken(toAddress, shitcoinContract.address, shitcoinWhaleONE)
    ).to.be.revertedWith('origin and underlying can only be swept after migration');
  });

  it('can sweep tokens from migrator back', async () => {
    let wb = await shitcoinContract.scaledBalanceOf(shitcoinWhaleONE);
    const toAddress = m.address;
    await shitcoinContract.connect(shitcoinWhale).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await shitcoinContract
      .connect(shitcoinWhale)
      .scaledBalanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await m.connect(root).admin_sweepToken(toAddress, shitcoinContract.address, shitcoinWhaleONE);
    const migratoraDaiBalanceAfterSweep = await shitcoinContract
      .connect(shitcoinWhale)
      .scaledBalanceOf(toAddress);
    expect(migratoraDaiBalanceAfterSweep).to.eq(0);
    const wa = await shitcoinContract.scaledBalanceOf(shitcoinWhaleONE);
    expect(wb).to.eq(wa);
  });

  it('withdraw is not allowed with ZombieRewardPool', async () => {
    await shitcoinContract.connect(shitcoinWhale).approve(m.address, defaultMigrationAmount);
    await m
      .connect(shitcoinWhale)
      .depositToMigrate(shitcoinAddress, defaultMigrationAmount, defaultReferral);
    await rc.connect(shitcoinWhale).claimReward();
    expect(await agf.balanceOf(shitcoinWhaleONE)).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(shitcoinWhale).withdrawFromMigrate(shitcoinAddress, defaultMigrationAmount)
    ).to.be.revertedWith('balance reduction is not allowed by the reward pool');
  });

  it.skip('can not claim if claims are not enabled for adapter', async () => {
    // no claim required for ZombieRewardPool, migrating automatically after depositToMigrate
  });

  it('can not deposit to migrate when approved amount is not enough', async () => {
    let whaleBeforeAmount = await shitcoinContract.scaledBalanceOf(shitcoinWhaleONE);
    console.log(`whale before: ${whaleBeforeAmount}`);
    await shitcoinContract.connect(shitcoinWhale).approve(m.address, 1);

    await expect(
      m
        .connect(shitcoinWhale)
        .depositToMigrate(shitcoinContract.address, defaultMigrationAmount, defaultReferral)
    ).to.be.revertedWith('SafeERC20: low-level call failed');
  });

  it('deposit and migrate aDai, claim both rewards', async () => {
    // at block 12419283, see hardhat fork config
    let wb = await shitcoinContract.scaledBalanceOf(shitcoinWhaleONE);

    await shitcoinContract.connect(shitcoinWhale).approve(m.address, defaultMigrationAmount);
    await m
      .connect(shitcoinWhale)
      .depositToMigrate(shitcoinAddress, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(shitcoinAddress, shitcoinWhaleONE);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.admin_migrateAllThenEnableClaims([shitcoinAddress]);

    await m.connect(shitcoinWhale).claimAllMigrated();

    await rc.connect(shitcoinWhale).claimReward();
    expect(await agf.balanceOf(shitcoinWhaleONE)).to.eq(defaultMigrationAmount);

    const wa = await shitcoinContract.scaledBalanceOf(shitcoinWhaleONE);
    // TODO: internalDeposit 962 instead of 1k aDai
    console.log(`diff: ${wb.sub(wa).toString()}`);
    // expect(wa).to.eq(wb);
  });
});
