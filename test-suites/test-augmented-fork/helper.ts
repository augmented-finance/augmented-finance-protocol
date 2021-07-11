import rawBRE, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

export const impersonateAndGetSigner = async (addr: string): Promise<SignerWithAddress> => {
  await rawBRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addr],
  });
  return ethers.getSigner(addr);
};

export const impersonateAndGetContractByFunc = async (addr: string, f: Function): Promise<any> => {
  await rawBRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addr],
  });
  return await f(addr);
};
