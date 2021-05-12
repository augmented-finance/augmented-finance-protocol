import rawBRE, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ADAI_ADDRESS } from '../../tasks/dev/9_augmented_migrator';

// aDAI (mainnet) used here in different deployments as a shitcoin for zombie adapter
// and as a normal token for aaveAdapter
export const extTokenAddress = ADAI_ADDRESS;
export const extBigHolderAddress = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
export const defaultMigrationAmount = 1000;
export const defaultReferral = 101;

export const impersonateAndGetSigner = async (addr: string): Promise<SignerWithAddress> => {
  await rawBRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addr],
  });
  return ethers.getSigner(addr);
};
