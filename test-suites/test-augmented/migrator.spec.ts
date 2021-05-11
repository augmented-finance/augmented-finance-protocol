import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';
import { Migrator } from '../../types';
import { RAY } from '../../helpers/constants';
import rawBRE, { ethers } from 'hardhat';
import { getAToken, getMigrator } from '../../helpers/contracts-getters';
import { ADAI_ADDRESS } from '../../tasks/dev/9_augmented_migrator';
import BigNumber from 'bignumber.js';
import { SignerWithAddress } from './helpers/make-suite';
import { Signer } from 'ethers';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

chai.use(solidity);
const { expect } = chai;

makeSuite('Migrator test suite', (testEnv: TestEnv) => {
  let m: Migrator;
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
  });

  it('deposit and migrate aDai', async () => {
    const referral = 101;
    const aDaiAmount = await convertToCurrencyDecimals(ADAI_ADDRESS, '1000');
    // impersonate mainnet aDAI, mint for user1, try deposit
    await rawBRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [ADAI_ADDRESS],
    });
    const aDaiContract = await getAToken(ADAI_ADDRESS);
    await aDaiContract.connect(aDaiSigner).mint(user1.address, aDaiAmount, 1);
    await m.connect(user1.signer).depositToMigrate(ADAI_ADDRESS, aDaiAmount, referral);
  });
});
