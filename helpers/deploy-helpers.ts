import { ContractTransaction } from 'ethers';
import { AccessController, MarketAccessController } from '../types';
import { AccessFlags } from './access-flags';
import {
  getMarketAddressController,
  getPreDeployedAddressController,
  hasMarketAddressController,
  hasPreDeployedAddressController,
} from './contracts-getters';
import { falsyOrZeroAddress, logExternalContractInJsonDb, sleep, waitForTx } from './misc-utils';
import { eContractid, tEthereumAddress } from './types';

export const getDeployAccessController = async (): Promise<
  [boolean, boolean, MarketAccessController]
> => {
  if (await hasPreDeployedAddressController()) {
    const ac = await getPreDeployedAddressController();
    if (await hasMarketAddressController()) {
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
    logExternalContractInJsonDb(eContractid.PreDeployedMarketAccessController, existingProvider!);
    return [false, await getMarketAddressController(existingProvider)];
  } else if (await hasMarketAddressController()) {
    const ac = await getMarketAddressController();
    logExternalContractInJsonDb(eContractid.PreDeployedMarketAccessController, ac.address);
    return [true, ac];
  } else {
    return [false, undefined];
  }
};

export const setAndGetAddressAsProxy = async (
  ac: AccessController,
  id: AccessFlags,
  addr: tEthereumAddress
) => {
  waitForTx(await ac.setAddressAsProxy(id, addr, { gasLimit: 2000000 }));
  return await waitForAddress(ac, id);
};

export const setAndGetAddressAsProxyWithInit = async (
  ac: AccessController,
  id: AccessFlags,
  addr: tEthereumAddress,
  data: string
) => {
  waitForTx(await ac.setAddressAsProxyWithInit(id, addr, data, { gasLimit: 2000000 }));
  return await waitForAddress(ac, id);
};

export const waitForAddress = async (ac: AccessController, id: AccessFlags) => {
  for (let i = 0; i <= 10; i++) {
    const result = await ac.getAddress(id);
    if (!falsyOrZeroAddress(result)) {
      return result;
    }
    await sleep(100 + 1000 * i);
    if (i > 3) {
      console.log('... waiting for address: ', id, i);
    }
  }
  throw 'failed to get an address';
};
