import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
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
import { ADAI_ADDRESS } from '../../tasks/dev/9_augmented_migrator';
import { SignerWithAddress } from '../test-augmented/helpers/make-suite';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {
  defaultMigrationAmount,
  defaultReferral,
  extBigHolderAddress,
  extTokenAddress, impersonateAndGetContractByFunc,
  impersonateAndGetSigner,
} from './helper';
import { revertSnapshot, takeSnapshot } from '../test-augmented/utils';

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
    extBigHolder = await impersonateAndGetSigner(extBigHolderAddress);
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

  it('withdraw is not allowed with ZombieRewardPool', async () => {
    await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extBigHolderAddress)).to.eq(defaultMigrationAmount);

    await expect(
      m.connect(extBigHolder).withdrawFromMigrate(extTokenAddress, defaultMigrationAmount)
    ).to.be.revertedWith('balance reduction is not allowed by the reward pool');
  });

  it.skip('can not claim if claims are not enabled for adapter', async () => {
    // no claim required for ZombieRewardPool, migrating automatically after depositToMigrate
  });

  it('can not deposit to migrate when approved amount is not enough', async () => {
    let whaleBeforeAmount = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale before: ${whaleBeforeAmount}`);
    await (await aDaiContract
      .connect(extBigHolder)
      .approve(m.address, 0)).wait(1);

    await expect(
      m
        .connect(extBigHolder)
        .depositToMigrate(aDaiContract.address, defaultMigrationAmount, defaultReferral)
    ).to.be.revertedWith('SafeERC20: low-level call failed');
  });

  it('deposit and migrate aDai, claim rewards', async () => {
    // at block 12419283, see hardhat fork config
    let whaleBeforeAmount = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale before: ${whaleBeforeAmount}`);

    await aDaiContract.connect(extBigHolder).approve(m.address, defaultMigrationAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(extTokenAddress, extBigHolderAddress);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extBigHolderAddress)).to.eq(defaultMigrationAmount);
    const whaleBalanceAfter = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale after: ${whaleBalanceAfter}`);
    // TODO: how to check the whale balance correctly?!
  });
});
