import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import { AaveAdapter, CompAdapter, DepositToken, Migrator, MockAgfToken, RewardFreezer } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAaveAdapter,
  getAToken, getCompAdapter,
  getMigrator, getMintableERC20,
  getMockAgfToken,
  getRewardFreezer,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '../test-augmented/helpers/make-suite';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import {
  cWhaleONE,
  cWhaleTHREE,
  cWhaleTWO,
  defaultMigrationAmount,
  defaultReferral,
  impersonateAndGetContractByFunc,
  impersonateAndGetSigner,
} from './helper';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { CDAI_ADDRESS, CFG } from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let compAdapter: CompAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let user1: SignerWithAddress;
  let cDaiContract: DepositToken;
  let cWhaleONESigner: Provider | Signer | string;
  let cWhaleTWOSigner: Provider | Signer | string;
  let cWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [CDAI_ADDRESS],
    });
    cDaiContract = await getAToken(CDAI_ADDRESS);
    // cDaiContract = await impersonateAndGetContractByFunc(CDAI_ADDRESS, getAToken);
    cWhaleONESigner = await impersonateAndGetSigner(cWhaleONE);
    cWhaleTWOSigner = await impersonateAndGetSigner(cWhaleTWO);
    cWhaleTHREESigner = await impersonateAndGetSigner(cWhaleTHREE);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    await rawBRE.run('augmented:test-local', CFG);
    compAdapter = await getCompAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  const depositToMigrate = async (signer: string | Provider | Signer, amount: number) => {
    await cDaiContract.connect(signer).approve(m.address, amount);
    await m.connect(signer).depositToMigrate(CDAI_ADDRESS, amount, defaultReferral);
  };

  it('one deposit, one whale, withdraw 50% at block 5, 10 blocks', async () => {
    await depositToMigrate(cWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed / 2);
    await m.connect(cWhaleONESigner).withdrawFromMigrate(CDAI_ADDRESS, defaultMigrationAmount);
    console.log(`balance for migrate: ${await m.balanceForMigrate(CDAI_ADDRESS, cWhaleONE)}`);
    await m.connect(root).admin_migrateAllThenEnableClaims([CDAI_ADDRESS]);
    await rc.connect(cWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cWhaleONE)).to.eq(defaultBlocksPassed / 2);
  });

  it('one deposit, one whale, 10 blocks', async () => {
    await depositToMigrate(cWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([CDAI_ADDRESS]);
    await rc.connect(cWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cWhaleONE)).to.eq(defaultBlocksPassed + 1);
  });

  it('two deposits, two whales, 1/2 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(cWhaleTWOSigner, defaultMigrationAmount);
    //
    await depositToMigrate(cWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([CDAI_ADDRESS]);
    await rc.connect(cWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cWhaleONE)).to.eq(4);
  });

  it('two deposits, two whales, 1/3 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(cWhaleTWOSigner, defaultMigrationAmount * 2);
    //
    await depositToMigrate(cWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([CDAI_ADDRESS]);
    await rc.connect(cWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cWhaleONE)).to.eq(2);
  });
});
