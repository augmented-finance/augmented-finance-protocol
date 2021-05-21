import rawBRE, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { DepositToken } from '../../types';
import { getAToken, getProtocolDataProvider } from '../../helpers/contracts-getters';

export const defaultMigrationAmount = 1000;
export const defaultReferral = 101;

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

// TODO: names are still from aave, so aDAI is agDAI, change them!
export const getAGTokenByName = async (name: string): Promise<DepositToken> => {
  const dp = await getProtocolDataProvider();
  const tokens = await dp.getAllATokens();
  console.log(`all deposit tokens: ${tokens}`);
  const addrByName = tokens.filter((v) => v.symbol === name)[0].tokenAddress;
  console.log(`deposit token addr by name ${name}: ${addrByName}`);
  return await getAToken(addrByName);
};
