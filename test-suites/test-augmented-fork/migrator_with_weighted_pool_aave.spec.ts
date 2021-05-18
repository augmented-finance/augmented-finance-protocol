import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import { AaveAdapter, DepositToken, Migrator, MockAgfToken, RewardFreezer } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAaveAdapter,
  getAToken, getLendingPool,
  getMigrator,
  getMockAgfToken, getProtocolDataProvider,
  getRewardFreezer,
} from '../../helpers/contracts-getters';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {
  defaultMigrationAmount,
  defaultReferral,
  impersonateAndGetContractByFunc,
  impersonateAndGetSigner,
} from './helper';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import {
  ADAI_ADDRESS,
  aDaiWhaleONE,
  aDaiWhaleTHREE,
  aDaiWhaleTWO,
  CFG,
} from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let aDaiContract: DepositToken;
  let agDaiContract: DepositToken;
  let extWhaleONESigner: Provider | Signer | string;
  let extWhaleTWOSigner: Provider | Signer | string;
  let extWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root] = await ethers.getSigners();
    aDaiContract = await impersonateAndGetContractByFunc(ADAI_ADDRESS, getAToken);
    extWhaleONESigner = await impersonateAndGetSigner(aDaiWhaleONE);
    extWhaleTWOSigner = await impersonateAndGetSigner(aDaiWhaleTWO);
    extWhaleTHREESigner = await impersonateAndGetSigner(aDaiWhaleTHREE);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    await rawBRE.run('augmented:test-local', CFG);
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
    await m.connect(signer).depositToMigrate(ADAI_ADDRESS, amount, defaultReferral);
  };

  it('one deposit, one whale, withdraw 50% at block 5, 10 blocks', async () => {
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed / 2);
    await m.connect(extWhaleONESigner).withdrawFromMigrate(ADAI_ADDRESS, defaultMigrationAmount);
    console.log(`balance for migrate: ${await m.balanceForMigrate(ADAI_ADDRESS, aDaiWhaleONE)}`);
    await m.connect(root).admin_migrateAllThenEnableClaims([ADAI_ADDRESS]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed / 2);
  });

  it('one deposit, one whale, 10 blocks', async () => {
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([ADAI_ADDRESS]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed + 1);
  });

  it('two deposits, two whales, 1/2 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(extWhaleTWOSigner, defaultMigrationAmount);
    //
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([ADAI_ADDRESS]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(4);
  });

  it('two deposits, two whales, 1/3 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(extWhaleTWOSigner, defaultMigrationAmount * 2);
    //
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([ADAI_ADDRESS]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(2);
  });

  // it.skip('deposit and migrate, can not claim AG if not enabled', async () => {
  //   let wb = await aDaiContract.scaledBalanceOf(extWhaleONE);
  //
  //   await aDaiContract.connect(extWhaleONESigner).approve(m.address, defaultMigrationAmount);
  //   await m
  //     .connect(extWhaleONESigner)
  //     .depositToMigrate(ADAI_ADDRESS, defaultMigrationAmount, defaultReferral);
  //   const balanceForMigrate = await m.connect(root).balanceForMigrate(ADAI_ADDRESS, extWhaleONE);
  //   expect(balanceForMigrate).to.eq(defaultMigrationAmount);
  //
  //   await m.admin_migrateToToken(ADAI_ADDRESS);
  //   await m.connect(extWhaleONESigner).claimAllMigrated();
  //   // TODO: check that ag balance is zero
  // });
});
