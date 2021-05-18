import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-augmented/helpers/make-suite';
import {
  CompAdapter,
  DepositToken,
  Migrator,
  MintableERC20,
  MockAgfToken,
  RewardFreezer,
} from '../../types';
import rawBRE, { ethers } from 'hardhat';
import {
  getAToken,
  getCompAdapter,
  getMigrator,
  getMintableERC20,
  getMockAgfToken,
  getRewardFreezer,
} from '../../helpers/contracts-getters';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { defaultMigrationAmount, defaultReferral, getAGTokenByName, impersonateAndGetSigner } from './helper';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import {
  CDAI_ADDRESS,
  cDaiWhaleONE,
  cDaiWhaleTHREE,
  cDaiWhaleTWO,
  CFG,
} from '../../tasks/migrations/defaultTestDeployConfig';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let compAdapter: CompAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let cDaiContract: MintableERC20;
  let agDaiContract: DepositToken;
  let cDaiWhaleONESigner: Provider | Signer | string;
  let cDaiWhaleTWOSigner: Provider | Signer | string;
  let cWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root] = await ethers.getSigners();
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [CDAI_ADDRESS],
    });
    cDaiContract = await getMintableERC20(CDAI_ADDRESS);
    agDaiContract = await getAGTokenByName('aDAI');
    cDaiWhaleONESigner = await impersonateAndGetSigner(cDaiWhaleONE);
    cDaiWhaleTWOSigner = await impersonateAndGetSigner(cDaiWhaleTWO);
    cWhaleTHREESigner = await impersonateAndGetSigner(cDaiWhaleTHREE);
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
    await depositToMigrate(cDaiWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed / 2);
    await m.connect(cDaiWhaleONESigner).withdrawFromMigrate(CDAI_ADDRESS, defaultMigrationAmount);
    console.log(`balance for migrate: ${await m.balanceForMigrate(CDAI_ADDRESS, cDaiWhaleONE)}`);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(cDaiWhaleONESigner).claimReward();
    // + one for migrateAll tx
    // TODO: why such result?!
    expect(await agf.balanceOf(cDaiWhaleONE)).to.eq(defaultBlocksPassed / 2);
  });

  it('one deposit, one whale, 10 blocks', async () => {
    await depositToMigrate(cDaiWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(cDaiWhaleONESigner).claimReward();
    // + one for migrateAll tx
    // TODO: why such result?!
    expect(await agf.balanceOf(cDaiWhaleONE)).to.eq(defaultBlocksPassed + 1);
  });

  it('two deposits, two whales, 1/2 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(cDaiWhaleTWOSigner, defaultMigrationAmount);
    //
    await depositToMigrate(cDaiWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(cDaiWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cDaiWhaleONE)).to.eq(4);
  });

  it('two deposits, two whales, 1/3 rewards share, 10 blocks', async () => {
    // prepare
    await depositToMigrate(cDaiWhaleTWOSigner, defaultMigrationAmount * 2);
    //
    await depositToMigrate(cDaiWhaleONESigner, defaultMigrationAmount);
    await mineToBlock((await currentBlock()) + defaultBlocksPassed);
    await m.connect(root).admin_migrateAllThenEnableClaims([agDaiContract.address]);
    await rc.connect(cDaiWhaleONESigner).claimReward();
    // + one for migrateAll tx
    expect(await agf.balanceOf(cDaiWhaleONE)).to.eq(2);
  });
});
