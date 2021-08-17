import { ethers } from 'ethers';
import { AccessController, MarketAccessController } from '../types';
import { AccessFlags } from './access-flags';
import {
  getMarketAddressController,
  getPreDeployedAddressController,
  hasMarketAddressController,
  hasPreDeployedAddressController,
} from './contracts-getters';
import { falsyOrZeroAddress, addNamedToJsonDb, sleep, waitForTx, addProxyToJsonDb } from './misc-utils';
import { eContractid, tEthereumAddress } from './types';

export const getDeployAccessController = async (): Promise<[boolean, boolean, MarketAccessController]> => {
  if (hasPreDeployedAddressController()) {
    const ac = await getPreDeployedAddressController();
    if (hasMarketAddressController()) {
      return [true, true, ac];
    }
    // TODO continuation for pre-deployed
    return [false, false, ac];
  }
  return [true, false, await getMarketAddressController()];
};

export const setPreDeployAccessController = async (
  existingProvider: tEthereumAddress | undefined
): Promise<[boolean, MarketAccessController | undefined]> => {
  if (!falsyOrZeroAddress(existingProvider)) {
    addNamedToJsonDb(eContractid.PreDeployedMarketAccessController, existingProvider!);
    return [false, await getMarketAddressController(existingProvider)];
  } else if (hasMarketAddressController()) {
    const ac = await getMarketAddressController();
    addNamedToJsonDb(eContractid.PreDeployedMarketAccessController, ac.address);
    return [true, ac];
  } else {
    return [false, undefined];
  }
};

const initEncoder = new ethers.utils.Interface(['function initialize(address)']);

export const setAndGetAddressAsProxy = async (ac: AccessController, id: AccessFlags, addr: tEthereumAddress) => {
  waitForTx(await ac.setAddressAsProxy(id, addr, { gasLimit: 2000000 }));
  const proxyAddr = await waitForAddress(ac, id);

  const data = initEncoder.encodeFunctionData('initialize', [ac.address]);
  await addProxyToJsonDb(AccessFlags[id], proxyAddr, addr, [ac.address, addr, data]);
  return proxyAddr;
};

export const setAndGetAddressAsProxyWithInit = async (
  ac: AccessController,
  id: AccessFlags,
  addr: tEthereumAddress,
  data: string
) => {
  waitForTx(await ac.setAddressAsProxyWithInit(id, addr, data, { gasLimit: 2000000 }));
  const proxyAddr = await waitForAddress(ac, id);
  await addProxyToJsonDb(AccessFlags[id], proxyAddr, addr, [ac.address, addr, data]);
  return proxyAddr;
};

export const waitForAddress = async (ac: AccessController, id: AccessFlags) => {
  for (let i = 0; i <= 20; i++) {
    const result = await ac.getAddress(id);
    if (!falsyOrZeroAddress(result)) {
      return result;
    }
    await sleep(100 + 1000 * i);
    if (i > 3) {
      console.log('... waiting for address: ', AccessFlags[id], i);
    }
  }
  throw 'failed to get an address';
};
