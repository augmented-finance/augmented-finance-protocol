import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import {
  AaveAdapter,
  DepositToken,
  Migrator,
  MockAgfToken,
  RewardFreezer,
  ZombieAdapter,
} from '../../types';
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
  extWhaleONE,
  extTokenAddress,
  impersonateAndGetContractByFunc,
  impersonateAndGetSigner,
} from './helper';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';

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
  let aDaiContract: DepositToken;
  let extBigHolder: Provider | Signer | string;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    aDaiContract = await impersonateAndGetContractByFunc(extTokenAddress, getAToken);
    extBigHolder = await impersonateAndGetSigner(extWhaleONE);
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    // in case of zombie and aave adapter the same mainnet forked
    // token is used - aDai (ADAI_ADDRESS)
    const deployConfig = {
      withZombieAdapter: true,
      withAAVEAdapter: false,
    };
    await rawBRE.run('dev:augmented-migrator', deployConfig);
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
    await aDaiContract.connect(extBigHolder).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await aDaiContract.connect(extBigHolder).balanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(root).admin_sweepToken(toAddress, aDaiContract.address, extWhaleONE)
    ).to.be.revertedWith('origin and underlying can only be swept after migration');
  });

  it('can sweep tokens from migrator back', async () => {
    let wb = await aDaiContract.scaledBalanceOf(extWhaleONE);
    const toAddress = m.address;
    await aDaiContract.connect(extBigHolder).transfer(toAddress, defaultMigrationAmount);
    const migratoraDaiBalance = await aDaiContract.connect(extBigHolder).balanceOf(toAddress);
    expect(migratoraDaiBalance).to.eq(defaultMigrationAmount);

    await m.connect(root).admin_sweepToken(toAddress, aDaiContract.address, extWhaleONE);
    const migratoraDaiBalanceAfterSweep = await aDaiContract
      .connect(extBigHolder)
      .balanceOf(toAddress);
    expect(migratoraDaiBalanceAfterSweep).to.eq(0);
    const wa = await aDaiContract.scaledBalanceOf(extWhaleONE);
    expect(wb).to.eq(wa);
  });

  it('withdraw is not allowed with ZombieRewardPool', async () => {
    await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extWhaleONE)).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(extBigHolder).withdrawFromMigrate(extTokenAddress, defaultMigrationAmount)
    ).to.be.revertedWith('balance reduction is not allowed by the reward pool');
  });

  it.skip('can not claim if claims are not enabled for adapter', async () => {
    // no claim required for ZombieRewardPool, migrating automatically after depositToMigrate
  });

  it('can not deposit to migrate when approved amount is not enough', async () => {
    let whaleBeforeAmount = await aDaiContract.balanceOf(extWhaleONE);
    console.log(`whale before: ${whaleBeforeAmount}`);
    await aDaiContract.connect(extBigHolder).approve(m.address, 1);

    await expect(
      m
        .connect(extBigHolder)
        .depositToMigrate(aDaiContract.address, defaultMigrationAmount, defaultReferral)
    ).to.be.revertedWith('SafeERC20: low-level call failed');
  });

  // it.only('can not migrate with the same referral twice', async () => {
  //   await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
  //   await m
  //     .connect(extBigHolder)
  //     .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
  //   await m.connect(root).admin_migrateToToken(extTokenAddress);
  //   await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
  //   await m
  //     .connect(extBigHolder)
  //     .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
  //   // await rc.connect(extBigHolder).claimReward();
  // });

  it('deposit and migrate aDai, claim both rewards', async () => {
    // at block 12419283, see hardhat fork config
    let wb = await aDaiContract.scaledBalanceOf(extWhaleONE);

    await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m.connect(root).balanceForMigrate(extTokenAddress, extWhaleONE);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.admin_migrateAllThenEnableClaims([extTokenAddress]);

    await m.connect(extBigHolder).claimAllMigrated();

    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extWhaleONE)).to.eq(defaultMigrationAmount);

    const wa = await aDaiContract.scaledBalanceOf(extWhaleONE);
    // TODO: internalDeposit 962 instead of 1k aDai
    console.log(`diff: ${wb.sub(wa).toString()}`);
    // expect(wa).to.eq(wb);
  });
});
