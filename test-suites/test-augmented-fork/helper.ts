import rawBRE, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ADAI_ADDRESS, SHITCOINT_ADDRESS } from '../../tasks/migrations/defaultTestDeployConfig';

export const extTokenAddress = ADAI_ADDRESS;
export const shitcoinAddress = ADAI_ADDRESS;
export const shitcoinWhaleONE = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
export const extWhaleONE = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
export const extWhaleTWO = '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296';
export const extWhaleTHREE = '0x449f284c8f884f487907a348921715b7cabf213f';
export const cWhaleONE = '0x4031afd3b0f71bace9181e554a9e680ee4abe7df';
export const cWhaleTWO = '0x742fb193517619eecd6595ff106fce2f45488ebf';
export const cWhaleTHREE = '0x4c81ac8a069122d2a7146b08818fbaddcb2ff1f0';
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
