import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { AaveAdapter, DepositToken, Migrator, MockAgfToken, RewardFreezer, ZombieAdapter } from '../../types';
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
import { impersonateAndGetSigner } from './helper';
import BigNumber from 'bignumber.js';
import { oneRay, RAY } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite', (testEnv: TestEnv) => {
  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let zAdapter: ZombieAdapter;
  let adapterAddress: string;
  let agf: MockAgfToken;
  let rc: RewardFreezer;
  let root: Provider | Signer | string;
  let user1: SignerWithAddress;
  let aDaiContract: DepositToken;
  let extBigHolder: Provider | Signer | string;

  // aDAI (mainnet) used here in different deployments as a shitcoin for zombie adapter
  // and as a normal token for aaveAdapter
  const extTokenAddress = ADAI_ADDRESS;
  const extBigHolderAddress = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
  const defaultReferal = 101;

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
    // in case of zombie and aave adapter the same mainnet forked
    // token is used - aDai (ADAI_ADDRESS)
    const deployConfig = {
      withZombieAdapter: true,
      withAAVEAdapter: false,
    };
    await rawBRE.run('dev:augmented-migrator', deployConfig);
    if (deployConfig.withZombieAdapter) {
      zAdapter = await getZombieAdapter();
      adapterAddress = zAdapter.address;
    } else if (deployConfig.withAAVEAdapter) {
      aaveAdapter = await getAaveAdapter();
      adapterAddress = aaveAdapter.address;
    }
    m = await getMigrator();
    agf = await getMockAgfToken();
    rc = await getRewardFreezer();
  });

  // TODO: add bound cases for partial migration

  // it.only('can not claim without deposit', async () => {
  //   await m.admin_migrateAllThenEnableClaims([extTokenAddress]);
  //   await rc.connect(extBigHolder).claimReward();
  //   await expect(rc.connect(extBigHolder).claimReward()).to.be.revertedWith('abc');
  // });

  it('deposit and migrate aDai, claim rewards', async () => {
    // at block 12419283, see hardhat fork config
    let whaleBeforeAmount = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale before: ${whaleBeforeAmount}`);

    await aDaiContract.connect(extBigHolder).approve(adapterAddress, whaleBeforeAmount);
    await m
      .connect(extBigHolder)
      .depositToMigrate(extTokenAddress, whaleBeforeAmount, defaultReferal);
    const balanceForMigrate = await m
      .connect(root)
      .balanceForMigrate(extTokenAddress, extBigHolderAddress);
    expect(balanceForMigrate).to.eq(whaleBeforeAmount);

    await m.admin_migrateAllThenEnableClaims([extTokenAddress]);
    await rc.connect(extBigHolder).claimReward();
    expect(await agf.balanceOf(extBigHolderAddress)).to.eq(whaleBeforeAmount);
    const whaleBalanceAfter = await aDaiContract.balanceOf(extBigHolderAddress);
    console.log(`whale after: ${whaleBalanceAfter}`);
    // expect(whaleBalanceAfter).to.eq(new BigNumber(727372501044215846));
  });
});
