import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import { AaveAdapter, DepositToken, Migrator, MockAgfToken, RewardFreezer } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAaveAdapter,
  getAToken,
  getMigrator,
  getMockAgfToken,
  getRewardFreezer,
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
  extWhaleTWO,
  extWhaleTHREE,
} from './helper';
import {
  currentBlock,
  mineToBlock,
  revertSnapshot,
  takeSnapshot,
} from '../test-augmented/utils';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let user1: SignerWithAddress;
  let aDaiContract: DepositToken;
  let extWhaleONESigner: Provider | Signer | string;
  let extWhaleTWOSigner: Provider | Signer | string;
  let extWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    aDaiContract = await impersonateAndGetContractByFunc(extTokenAddress, getAToken);
    extWhaleONESigner = await impersonateAndGetSigner(extWhaleONE);
    extWhaleTWOSigner = await impersonateAndGetSigner(extWhaleTWO);
    extWhaleTHREESigner = await impersonateAndGetSigner(extWhaleTHREE);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    const deployConfig = {
      withZombieAdapter: false,
      withAAVEAdapter: true,
    };
    await rawBRE.run('augmented:test-local', { ...CFG, ...deployConfig });
    aaveAdapter = await getAaveAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const depositToMigrate = async (signer: string | Provider | Signer, amount: number) => {
    await aDaiContract.connect(signer).approve(m.address, amount);
    await m.connect(signer).depositToMigrate(extTokenAddress, amount, defaultReferral);
  };

  it('one deposit, one whale, withdraw 50% at block 5, 10 blocks', async () => {
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed / 2);
    await m.connect(extWhaleONESigner).withdrawFromMigrate(extTokenAddress, defaultMigrationAmount);
    console.log(`balance for migrate: ${await m.balanceForMigrate(extTokenAddress, extWhaleONE)}`);
    await m.connect(root).admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(extWhaleONE)).to.eq(defaultBlocksPassed / 2);
  });

  it('one deposit, one whale, 10 blocks', async () => {
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(extWhaleONE)).to.eq(defaultBlocksPassed + 1);
  });

  it('two deposits, two whales, 1/2 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(extWhaleTWOSigner, defaultMigrationAmount);
    //
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(extWhaleONE)).to.eq(4);
  });

  it('two deposits, two whales, 1/3 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(extWhaleTWOSigner, defaultMigrationAmount * 2);
    //
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(extWhaleONE)).to.eq(2);
  });

  it.skip('deposit and migrate, can not claim AG if not enabled', async () => {
    let wb = await aDaiContract.scaledBalanceOf(extWhaleONE);

    await aDaiContract.connect(extWhaleONESigner).approve(m.address, defaultMigrationAmount);
    await m
      .connect(extWhaleONESigner)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m.connect(root).balanceForMigrate(extTokenAddress, extWhaleONE);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.admin_migrateToToken(extTokenAddress);
    await m.connect(extWhaleONESigner).claimAllMigrated();
    // TODO: check that ag balance is zero
  });
});
