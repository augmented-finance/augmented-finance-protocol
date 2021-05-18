import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import {
  AaveAdapter,
  DepositToken,
  Migrator,
  MintableERC20,
  MockAgfToken,
  RewardFreezer,
} from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAaveAdapter,
  getMigrator,
  getMintableERC20,
  getMockAgfToken,
  getRewardFreezer,
} from '../../helpers/contracts-getters';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {
  defaultMigrationAmount,
  defaultReferral,
  getAGTokenByName,
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
  let aDaiContract: MintableERC20;
  let agDaiContract: DepositToken;
  let extWhaleONESigner: Provider | Signer | string;
  let extWhaleTWOSigner: Provider | Signer | string;
  let extWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root] = await ethers.getSigners();
    aDaiContract = await getMintableERC20(ADAI_ADDRESS);
    agDaiContract = await getAGTokenByName('aDAI');
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
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed / 2);
  });

  it('one deposit, one whale, 10 blocks', async () => {
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await m.connect(extWhaleONESigner).claimAllMigrated();
    await rc.connect(extWhaleONESigner).claimReward();
    // + two blocks for migrate'n'claim txs
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed + 2);
    expect(await agDaiContract.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed + 2);
  });

  it('two deposits, two whales, 1/2 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(extWhaleTWOSigner, defaultMigrationAmount);
    //
    await depositToMigrate(extWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
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
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(extWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(2);
  });
});
