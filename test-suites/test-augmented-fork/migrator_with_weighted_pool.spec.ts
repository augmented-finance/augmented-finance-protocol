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
  getAaveAdapter,
  getAToken,
  getMigrator,
  getMockAgfToken,
  getRewardFreezer,
  getZombieAdapter,
} from '../../helpers/contracts-getters';
import { ADAI_ADDRESS } from '../../tasks/dev/9_augmented_migrator';
import { SignerWithAddress } from '../test-augmented/helpers/make-suite';
import { Signer } from 'ethers';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { Provider } from '@ethersproject/providers';
import {
  defaultMigrationAmount, defaultReferral,
  extBigHolderAddress,
  extTokenAddress,
  impersonateAndGetSigner,
} from './helper';
import { revertSnapshot, takeSnapshot } from '../test-augmented/utils';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite (AAVE adapter + WeightedPool)', (testEnv: TestEnv) => {
  let blkBeforeDeploy;

  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let adapterAddress: string;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let user1: SignerWithAddress;
  let aDaiContract: DepositToken;
  let extBigHolder: Provider | Signer | string;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [extTokenAddress],
    });
    aDaiContract = await getAToken(extTokenAddress);
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
    adapterAddress = aaveAdapter.address;
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('deposit and migrate aDai, claim rewards', async () => {
    // at block 12419283, see hardhat fork config
    let whaleBeforeAmount = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale before: ${whaleBeforeAmount}`);

    await aDaiContract.connect(extBigHolder).approve(adapterAddress, defaultMigrationAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, defaultMigrationAmount, defaultReferral);
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(extTokenAddress, extBigHolderAddress);
    expect(balanceForMigrate).to.eq(defaultMigrationAmount);

    await m.admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extBigHolderAddress)).to.eq(defaultMigrationAmount / 1000);
    const whaleBalanceAfter = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale after: ${whaleBalanceAfter}`);
    // TODO: how to check the whale balance correctly?!
  });
});
