import { Wallet } from '@ethersproject/wallet';
import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/misc-utils';

task('new-address').setAction(async ({}, localBRE) => {
  const deployer = await getFirstSigner(localBRE);
  console.log('Deployer:', deployer.address);

  const w = Wallet.createRandom();

  console.log('Address: ', w.address);
  console.log('PK:      ', w.publicKey);
  console.log('SK:      ', w.privateKey);
  console.log('Mnemonic:', w.mnemonic);
});
