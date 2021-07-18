import { TestEnv, makeSuite } from './helpers/make-suite';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';

const { expect } = require('chai');

makeSuite('AddressesProviderRegistry', (testEnv: TestEnv) => {
  it('Checks the addresses provider is added to the registry', async () => {
    const { addressesProvider, registry } = testEnv;

    const providers = await registry.getAddressesProvidersList();

    expect(providers.length).to.be.equal(1, 'Invalid length of the addresses providers list');
    expect(providers[0].toString()).to.be.equal(
      addressesProvider.address,
      ' Invalid addresses provider added to the list'
    );
  });

  it('Register an addresses provider with id 0 (revert)', async () => {
    const { users, registry } = testEnv;
    const { LPAPR_INVALID_ADDRESSES_PROVIDER_ID } = ProtocolErrors;

    await expect(registry.registerAddressesProvider(users[2].address, '0')).to.be.revertedWith(
      LPAPR_INVALID_ADDRESSES_PROVIDER_ID
    );
  });

  it('Registers a new mock addresses provider', async () => {
    const { users, registry } = testEnv;

    //simulating an addresses provider using the users[1] wallet address
    await registry.registerAddressesProvider(users[1].address, '2');

    const providers = await registry.getAddressesProvidersList();

    expect(providers.length).to.be.equal(2, 'Invalid length of the addresses providers list');
    expect(providers[1].toString()).to.be.equal(
      users[1].address,
      ' Invalid addresses provider added to the list'
    );
  });

  it('Removes the mock addresses provider', async () => {
    const { users, registry, addressesProvider } = testEnv;

    const id = await registry.getAddressesProviderIdByAddress(users[1].address);

    expect(id).to.be.equal('2', 'Invalid isRegistered return value');

    await registry.unregisterAddressesProvider(users[1].address);

    const providers = await registry.getAddressesProvidersList();

    expect(providers.length).to.be.equal(1, 'Invalid length of the addresses providers list');
    expect(providers[0].toString()).to.be.equal(
      addressesProvider.address,
      ' Invalid addresses provider added to the list'
    );
  });

  it('Remove an unregistered addressesProvider (revert)', async () => {
    const { LPAPR_PROVIDER_NOT_REGISTERED } = ProtocolErrors;

    const { users, registry } = testEnv;

    await expect(registry.unregisterAddressesProvider(users[2].address)).to.be.revertedWith(
      LPAPR_PROVIDER_NOT_REGISTERED
    );
  });

  it('Add a registered addressesProvider with a different id. Should overwrite the id', async () => {
    const { users, registry, addressesProvider } = testEnv;

    const id = await registry.getAddressesProviderIdByAddress(addressesProvider.address);

    await registry.registerAddressesProvider(ONE_ADDRESS, id.add(1));
    await registry.registerAddressesProvider(addressesProvider.address, id.add(3));

    const providers = await registry.getAddressesProvidersList();

    expect(providers.length).eq(2);
    expect(providers[0]).eq(addressesProvider.address);
    expect(providers[1]).eq(ONE_ADDRESS);

    expect(await registry.getAddressesProviderIdByAddress(addressesProvider.address)).eq(id.add(3));
    expect(await registry.getAddressesProviderIdByAddress(ONE_ADDRESS)).eq(id.add(1));
  });

  it('Use one-time registrar, fixed id', async () => {
    const { users, registry, addressesProvider } = testEnv;
    const { LPAPR_INVALID_ADDRESSES_PROVIDER_ID } = ProtocolErrors;

    const anotherUser = users[2];

    await expect(
      registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 2)
    ).to.be.revertedWith(ProtocolErrors.TXT_OWNABLE_CALLER_NOT_OWNER);

    await registry.setOneTimeRegistrar(anotherUser.address, 5);
    const regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);
    expect(regInfo.expectedId).eq(5);

    await expect(
      registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 2)
    ).to.be.revertedWith(LPAPR_INVALID_ADDRESSES_PROVIDER_ID);

    await registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 5);

    await expect(
      registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 6)
    ).to.be.revertedWith(ProtocolErrors.TXT_OWNABLE_CALLER_NOT_OWNER);

    const providers = await registry.getAddressesProvidersList();
    expect(providers.length).eq(2);

    expect(providers[0]).eq(addressesProvider.address);
    expect(providers[1]).eq(ONE_ADDRESS);
    expect(await registry.getAddressesProviderIdByAddress(ONE_ADDRESS)).eq(5);

    const regInfo2 = await registry.getOneTimeRegistrar();
    expect(regInfo2.user).eq(ZERO_ADDRESS);
    expect(regInfo2.expectedId).eq(0);
  });

  it('Use one-time registrar, open id', async () => {
    const { users, registry, addressesProvider } = testEnv;

    const anotherUser = users[2];

    await registry.setOneTimeRegistrar(anotherUser.address, 0);
    const regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);
    expect(regInfo.expectedId).eq(0);

    await registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 5);

    await expect(
      registry.connect(anotherUser.signer).registerAddressesProvider(ONE_ADDRESS, 6)
    ).to.be.revertedWith(ProtocolErrors.TXT_OWNABLE_CALLER_NOT_OWNER);

    const providers = await registry.getAddressesProvidersList();
    expect(providers.length).eq(2);

    expect(providers[0]).eq(addressesProvider.address);
    expect(providers[1]).eq(ONE_ADDRESS);
    expect(await registry.getAddressesProviderIdByAddress(ONE_ADDRESS)).eq(5);

    const regInfo2 = await registry.getOneTimeRegistrar();
    expect(regInfo2.user).eq(ZERO_ADDRESS);
    expect(regInfo2.expectedId).eq(0);
  });

  it('Renounce', async () => {
    const { users, registry, addressesProvider } = testEnv;

    const anotherUser = users[2];

    await registry.renounceOneTimeRegistrar(); // no error
    await registry.connect(users[1].signer).renounceOneTimeRegistrar(); // no error
    await registry.connect(users[2].signer).renounceOneTimeRegistrar(); // no error

    await registry.setOneTimeRegistrar(users[2].address, 0);

    let regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);

    await registry.connect(users[1].signer).renounceOneTimeRegistrar(); // no error, no impact

    regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);

    await registry.connect(users[2].signer).renounceOneTimeRegistrar();

    regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(ZERO_ADDRESS);

    await registry.connect(users[2].signer).renounceOneTimeRegistrar(); // no error
    await registry.connect(users[1].signer).renounceOneTimeRegistrar(); // no error
    await registry.renounceOneTimeRegistrar(); // no error

    await registry.setOneTimeRegistrar(users[2].address, 0);
    regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);

    await registry.renounceOneTimeRegistrar(); // no error, no impact

    regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(anotherUser.address);

    await registry.setOneTimeRegistrar(ZERO_ADDRESS, 0);

    regInfo = await registry.getOneTimeRegistrar();
    expect(regInfo.user).eq(ZERO_ADDRESS);
  });
});
