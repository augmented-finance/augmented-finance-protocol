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
  getAGTokenByName,
  getMigrator,
  getMintableERC20,
  getMockAgfToken,
  getRewardController,
} from '../../helpers/contracts-getters';
import { Signer } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { defaultMigrationAmount, defaultReferral, impersonateAndGetSigner } from './helper';
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

makeSuite('Fork test suite', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let aDaiContract: MintableERC20;
  let agDaiContract: DepositToken;
  let aDaiWhaleONESigner: Provider | Signer | string;
  let aDaiWhaleTWOSigner: Provider | Signer | string;
  let aDaiWhaleTHREESigner: Provider | Signer | string;

  const defaultBlocksPassed = 10;

  before(async () => {
    [root] = await ethers.getSigners();
    aDaiContract = await getMintableERC20(ADAI_ADDRESS);
    console.log(`=== aDAI contract addr: ${aDaiContract.address}`);
    agDaiContract = await getAGTokenByName('agDAI');
    console.log(`=== agDAI contract addr: ${agDaiContract.address}`);
    aDaiWhaleONESigner = await impersonateAndGetSigner(aDaiWhaleONE);
    aDaiWhaleTWOSigner = await impersonateAndGetSigner(aDaiWhaleTWO);
    aDaiWhaleTHREESigner = await impersonateAndGetSigner(aDaiWhaleTHREE);
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    await rawBRE.run('augmented:test-local', CFG);
    aaveAdapter = await getAaveAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardController();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  // const depositToMigrate = async (signer: string | Provider | Signer, amount: number) => {
  //   await aDaiContract.connect(signer).approve(m.address, amount);
  //   await m.connect(signer).depositToMigrate(ADAI_ADDRESS, amount, defaultReferral);
  // };

  // it('one deposit, one whale, withdraw 50% at block 5, 10 blocks', async () => {
  //   await depositToMigrate(aDaiWhaleONESigner, defaultMigrationAmount);
  //   await mineToBlock((await currentBlock()) + defaultBlocksPassed / 2);
  //   await m.connect(aDaiWhaleONESigner).withdrawFromMigrate(ADAI_ADDRESS, defaultMigrationAmount);
  //   console.log(`balance for migrate: ${await m.balanceForMigrate(ADAI_ADDRESS, aDaiWhaleONE)}`);
  //   await m.connect(root).migrateAllThenEnableClaims([agDaiContract.address]);
  //   await rc.connect(aDaiWhaleONESigner).claimReward();
  //   // + one for migrateAll tx
  //   expect(await agf.balanceOf(aDaiWhaleONE)).to.eq(defaultBlocksPassed / 2);
  // });
});
