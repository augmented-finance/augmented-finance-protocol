import { MarketAccessController } from '../types';
import {
  getMarketAddressController,
  getPreDeployedAddressController,
  hasMarketAddressController,
  hasPreDeployedAddressController,
} from './contracts-getters';
import { falsyOrZeroAddress, logExternalContractInJsonDb } from './misc-utils';
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
