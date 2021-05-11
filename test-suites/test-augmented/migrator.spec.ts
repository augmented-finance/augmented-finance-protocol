import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { AaveAdapter, Migrator } from '../../types';
import rawBRE, { ethers } from 'hardhat';
import { getAaveAdapter, getAToken, getMigrator } from '../../helpers/contracts-getters';
import { ADAI_ADDRESS, LP_ADDRESS } from '../../tasks/dev/9_augmented_migrator';
import { SignerWithAddress } from './helpers/make-suite';
import { Signer } from 'ethers';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { parseEther } from 'ethers/lib/utils';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite', (testEnv: TestEnv) => {
  let m: Migrator;
  let aaveAdapter: AaveAdapter;
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let aDaiSigner: Signer;

  before(async () => {
    [root, user1] = await ethers.getSigners();
    aDaiSigner = await ethers.getSigner(ADAI_ADDRESS);
    await rawBRE.run('dev:augmented-access');
  });

  beforeEach(async () => {
    await rawBRE.run('dev:augmented-migrator');
    m = await getMigrator();
    aaveAdapter = await getAaveAdapter();
  });

  it('deposit and migrate aDai', async () => {
    const bigHolder = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [bigHolder],
    });
    const bigHolderSigner = await ethers.getSigner(bigHolder);
    const referral = 101;
    const aDaiAmount = await convertToCurrencyDecimals(ADAI_ADDRESS, '10');
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [ADAI_ADDRESS],
    });

    const aDaiContract = await getAToken(ADAI_ADDRESS);
    await aDaiContract.connect(bigHolderSigner).approve(aaveAdapter.address, aDaiAmount);
    await m.connect(bigHolderSigner).depositToMigrate(ADAI_ADDRESS, aDaiAmount, referral);
  });
});
