import { expect } from 'chai';
import { createRandomAddress } from '../../helpers/misc-utils';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors } from '../../helpers/types';
import { ethers, Signer } from 'ethers';
import { waitForTx } from '../../helpers/misc-utils';
import { deployLendingPoolImpl, deployMintableERC20 } from '../../helpers/contracts-deployments';
import { ONE_ADDRESS } from '../../helpers/constants';
import BigNumber from 'bignumber.js';

const { utils } = ethers;

const BIT62 = new BigNumber(2).pow(62).toFixed();

makeSuite('MarketAccessController', (testEnv: TestEnv) => {
  it('Test access to the MarketAccessController (should revert)', async () => {
    const { addressesProvider, users } = testEnv;
    const mockAddress = createRandomAddress();
    const { INVALID_OWNER_REVERT_MSG } = ProtocolErrors;

    await addressesProvider.transferOwnership(users[1].address);
    await addressesProvider.connect(users[1].signer).acceptOwnership();

    for (const contractFunction of [addressesProvider.setMarketId]) {
      await expect(contractFunction(mockAddress)).to.be.revertedWith(INVALID_OWNER_REVERT_MSG);
    }

    await expect(addressesProvider.setAddress(BIT62, mockAddress)).to.be.revertedWith(INVALID_OWNER_REVERT_MSG);

    await expect(addressesProvider.setAddressAsProxy(BIT62, mockAddress)).to.be.revertedWith(INVALID_OWNER_REVERT_MSG);
  });

  it('Tests adding a proxied address with `setAddressAsProxy()`', async () => {
    const { addressesProvider, users } = testEnv;

    const currentAddressesProviderOwner = users[1];

    const mockLendingPool = await deployLendingPoolImpl(false, false);

    // await addressesProvider.connect(currentAddressesProviderOwner.signer).markProxies(BIT62);

    const proxiedAddressSetReceipt = await waitForTx(
      await addressesProvider
        .connect(currentAddressesProviderOwner.signer)
        .setAddressAsProxy(BIT62, mockLendingPool.address)
    );

    if (!proxiedAddressSetReceipt.events || proxiedAddressSetReceipt.events?.length < 1) {
      throw new Error('INVALID_EVENT_EMMITED');
    }

    expect(proxiedAddressSetReceipt.events[0].event).to.be.equal('ProxyCreated');
    expect(proxiedAddressSetReceipt.events[1].event).to.be.equal('AddressSet');
    expect(proxiedAddressSetReceipt.events[1].args?.id).to.be.equal(BIT62);
    expect(proxiedAddressSetReceipt.events[1].args?.newAddress).to.be.equal(mockLendingPool.address);
    expect(proxiedAddressSetReceipt.events[1].args?.hasProxy).to.be.equal(true);
  });

  it('Tests adding an address with `setAddress()` at proxied address id (should revert)', async () => {
    const { addressesProvider, users } = testEnv;

    const currentAddressesProviderOwner = users[1];
    const mockNonProxiedAddress = createRandomAddress();
    const proxiedAddressId = 1 << 62;

    await addressesProvider.connect(currentAddressesProviderOwner.signer).markProxies(proxiedAddressId);

    await expect(
      addressesProvider
        .connect(currentAddressesProviderOwner.signer)
        .setAddress(proxiedAddressId, mockNonProxiedAddress)
    ).to.be.revertedWith('setAddressAsProxy is required');
  });

  it('Tests adding a non contract address with `setAddress()` (should revert)', async () => {
    const { addressesProvider, users } = testEnv;

    const currentAddressesProviderOwner = users[1];

    const nonProxiedAddressId = 1 << 62;

    await addressesProvider.connect(currentAddressesProviderOwner.signer).unmarkProxies(nonProxiedAddressId);

    await expect(
      addressesProvider.connect(currentAddressesProviderOwner.signer).setAddress(nonProxiedAddressId, ONE_ADDRESS)
    ).to.be.revertedWith('must be contract');
  });

  it('Tests adding an address with `setAddress()`', async () => {
    const { addressesProvider, users } = testEnv;

    const currentAddressesProviderOwner = users[1];

    // must be a contract address
    const mockNonProxiedAddress = (await deployMintableERC20(['', '', 0])).address;
    const nonProxiedAddressId = 1 << 62;

    await addressesProvider.connect(currentAddressesProviderOwner.signer).unmarkProxies(nonProxiedAddressId);

    const nonProxiedAddressSetReceipt = await waitForTx(
      await addressesProvider
        .connect(currentAddressesProviderOwner.signer)
        .setAddress(nonProxiedAddressId, mockNonProxiedAddress)
    );

    expect(mockNonProxiedAddress.toLowerCase()).to.be.equal(
      (await addressesProvider.getAddress(nonProxiedAddressId)).toLowerCase()
    );

    if (!nonProxiedAddressSetReceipt.events || nonProxiedAddressSetReceipt.events?.length < 1) {
      throw new Error('INVALID_EVENT_EMMITED');
    }

    expect(nonProxiedAddressSetReceipt.events[0].event).to.be.equal('AddressSet');
    expect(nonProxiedAddressSetReceipt.events[0].args?.id).to.be.equal(nonProxiedAddressId);
    expect(nonProxiedAddressSetReceipt.events[0].args?.newAddress).to.be.equal(mockNonProxiedAddress);
    expect(nonProxiedAddressSetReceipt.events[0].args?.hasProxy).to.be.equal(false);
  });
});
