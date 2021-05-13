import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import {
  AaveAdapter,
  DepositToken,
  Migrator,
  MockAgfToken,
  RewardFreezer,
} from '../../types';
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
  defaultMigrationAmount, defaultReferral,
  extBigHolderAddress,
  extTokenAddress, impersonateAndGetContractByFunc,
  impersonateAndGetSigner,
} from './helper';
import { currentBlock, mineToBlock, revertSnapshot, takeSnapshot } from '../test-augmented/utils';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;
  let blkAfterDeploy;

  let m: Migrator;
  let aaveAdapter: AaveAdapter;
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
    const deployConfig = {
      withZombieAdapter: false,
      withAAVEAdapter: true,
    };
    await rawBRE.run('dev:augmented-migrator', deployConfig);
    aaveAdapter = await getAaveAdapter();
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
    blkAfterDeploy = await currentBlock();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('one deposit, multiple blocks', async () => {
    const depositsPerformed = 1;
    const blocksPassed = 20;

    await aDaiContract
      .connect(extBigHolder)
      .approve(m.address, defaultMigrationAmount * depositsPerformed);
    for (let i = 0; i < depositsPerformed; i++) {
      await m
        .connect(extBigHolder)
        .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    }
    const blkAfterDeposit = await currentBlock();
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(extTokenAddress, extBigHolderAddress);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount * depositsPerformed);

    await m.admin_migrateAllThenEnableClaims([extTokenAddress]);
    await mineToBlock(blkAfterDeposit + blocksPassed);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extBigHolderAddress)).to.eq(blocksPassed);
  });
});
