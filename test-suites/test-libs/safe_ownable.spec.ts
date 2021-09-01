import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';
import { MockSafeOwnable } from '../../types/MockSafeOwnable';
import { MockSafeOwnableFactory } from '../../types/MockSafeOwnableFactory';
import { getFirstSigner, getSigners, setDRE } from '../../helpers/misc-utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('SafeOwnable', () => {
  let subject: MockSafeOwnable;
  let user0: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress;

  before(async () => {
    setDRE(rawBRE);
    subject = await new MockSafeOwnableFactory(await getFirstSigner()).deploy();
    [user0, user1, user2] = await getSigners();
  });

  it('deployer is owner', async () => {
    expect(await subject.owner()).eq(user0.address);
    await subject.connect(user0).testAccess();
    
    expect(await subject.owner()).eq(user0.address);
    expect(await subject.owners()).eql([ZERO_ADDRESS, user0.address, user0.address]);
  });

  it('non-owner call (should revert)', async () => {
    await expect(subject.connect(user1).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user2).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('only owner can transfer ownership', async () => {
    await expect(subject.connect(user1).transferOwnership(user1.address)).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user1).transferOwnership(user2.address)).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user2).transferOwnership(user1.address)).to.be.revertedWith('Ownable: caller is not the owner');
    await subject.connect(user0).transferOwnership(user1.address);

    expect(await subject.owner()).eq(ZERO_ADDRESS);
    expect(await subject.owners()).eql([user0.address, ZERO_ADDRESS, user1.address]);
  });

  it('pending ownership prevents access', async () => {
    await expect(subject.connect(user0).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user1).testAccess()).to.be.revertedWith('Ownable: caller is not the owner (pending)');
    await expect(subject.connect(user2).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(subject.connect(user0).transferOwnership(user2.address)).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user1).transferOwnership(user2.address)).to.be.revertedWith('Ownable: caller is not the owner (pending)');
    await expect(subject.connect(user2).transferOwnership(user2.address)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('only pending owner can accept ownership once', async () => {
    await expect(subject.connect(user0).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');
    await expect(subject.connect(user2).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');

    await subject.connect(user1).acceptOwnership();
    expect(await subject.owner()).eq(user1.address);
    expect(await subject.owners()).eql([ZERO_ADDRESS, user1.address, user1.address]);

    await expect(subject.connect(user0).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');
    await expect(subject.connect(user1).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');
    await expect(subject.connect(user2).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');
  });

  it('new owner can access', async () => {
    await subject.connect(user1).testAccess();

    await expect(subject.connect(user0).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user2).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('new owner initiate ownership transfer, but recovers it', async () => {
    await subject.connect(user1).transferOwnership(user0.address);
    expect(await subject.owners()).eql([user1.address, ZERO_ADDRESS, user0.address]);

    await expect(subject.connect(user0).testAccess()).to.be.revertedWith('Ownable: caller is not the owner (pending)');
    await expect(subject.connect(user1).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user2).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(subject.connect(user0).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');
    await expect(subject.connect(user2).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');

    await subject.connect(user1).recoverOwnership();
    expect(await subject.owners()).eql([ZERO_ADDRESS, user1.address, user1.address]);

    await subject.connect(user1).testAccess();
    await expect(subject.connect(user0).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(subject.connect(user2).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(subject.connect(user0).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');
    await expect(subject.connect(user1).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');
    await expect(subject.connect(user2).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');
  });

  it('accept transfer to itself', async () => {
    await subject.connect(user1).testAccess();

    await subject.connect(user1).transferOwnership(user1.address);
    expect(await subject.owners()).eql([user1.address, ZERO_ADDRESS, user1.address]);

    await expect(subject.connect(user1).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(subject.connect(user0).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');
    await expect(subject.connect(user2).acceptOwnership()).to.be.revertedWith('SafeOwnable: caller is not the pending owner');

    await subject.connect(user1).acceptOwnership();
    await subject.connect(user1).testAccess();
  });

  it('recover transfer to itself', async () => {
    await subject.connect(user1).testAccess();

    await subject.connect(user1).transferOwnership(user1.address);
    expect(await subject.owners()).eql([user1.address, ZERO_ADDRESS, user1.address]);

    await expect(subject.connect(user1).testAccess()).to.be.revertedWith('Ownable: caller is not the owner');

    await expect(subject.connect(user0).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');
    await expect(subject.connect(user2).recoverOwnership()).to.be.revertedWith('SafeOwnable: caller can not recover ownership');

    await subject.connect(user1).recoverOwnership();
    await subject.connect(user1).testAccess();
  });
});
