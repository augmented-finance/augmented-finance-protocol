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
import { currentBlock, mineToBlock, oneBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';

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

  before(async () => {
    [root, user1] = await ethers.getSigners();
    aDaiContract = await impersonateAndGetContractByFunc(extTokenAddress, getAToken);
    extWhaleONESigner = await impersonateAndGetSigner(extWhaleONE);
    extWhaleTWOSigner = await impersonateAndGetSigner(extWhaleTWO);
    extWhaleTHREESigner = await impersonateAndGetSigner(extWhaleTHREE);
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    const deployConfig = {
      withZombieAdapter: false,
      withAAVEAdapter: true,
    };
    await rawBRE.run('dev:augmented-migrator', deployConfig);
    aaveAdapter = await getAaveAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('one deposit, one whale, 20 blocks', async () => {
    const depositsPerformed = 1;
    const blocksPassed = 20;

    await aDaiContract
      .connect(extWhaleONESigner)
      .approve(m.address, defaultMigrationAmount * depositsPerformed);
    for (let i = 0; i < depositsPerformed; i++) {
      await m
        .connect(extWhaleONESigner)
        .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    }
    const blkAfterDeposit = await currentBlock();
    const balanceForMigrate = await m.connect(root).balanceForMigrate(extTokenAddress, extWhaleONE);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount * depositsPerformed);

    await m.connect(root).admin_migrateAllThenEnableClaims([extTokenAddress]);
    await mineToBlock(blkAfterDeposit + blocksPassed);
    await rc.connect(extWhaleONESigner).claimReward();
    expect(await agf.balanceOf(extWhaleONE)).to.eq(blocksPassed);
  });

  it.skip('multiple deposits', async () => {
    const whales = [
      {
        signer: extWhaleONESigner,
        amount: defaultMigrationAmount,
        address: extWhaleONE,
        depositBlock: 0,
        waitBlocks: 0,
      },
      {
        signer: extWhaleTWOSigner,
        amount: defaultMigrationAmount,
        address: extWhaleTWO,
        depositBlock: 0,
        waitBlocks: 0,
      },
      {
        signer: extWhaleTHREESigner,
        amount: defaultMigrationAmount,
        address: extWhaleTHREE,
        depositBlock: 0,
        waitBlocks: 0,
      },
    ];

    for (let [idx, { signer, amount, address }] of Object.entries(whales)) {
      await aDaiContract.connect(signer).approve(m.address, amount); // tx
      await m.connect(signer).depositToMigrate(
        extTokenAddress, amount,
        defaultReferral + idx,
      ); // tx
      const cb = await currentBlock();
      whales[idx].depositBlock = cb;
      await mineToBlock(cb + whales[idx].waitBlocks);
    }
    await m.admin_migrateAllThenEnableClaims([extTokenAddress]); // tx
    await rc.connect(extWhaleONESigner).claimReward(); // tx
    await rc.connect(extWhaleTWOSigner).claimReward(); // tx
    for (const [idx, w] of Object.entries(whales)) {
      console.log(`whale #${idx}\nbalance: ${await agf.balanceOf(w.address)}\nwaited blocks: ${w.waitBlocks}\n`);
    }
    expect(await agf.balanceOf(extWhaleONE)).to.eq(whales[0].waitBlocks);
    // expect(await agf.balanceOf(extWhaleTWO)).to.eq(cb - whales[1].depositBlock);
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
