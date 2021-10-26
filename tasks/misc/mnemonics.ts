import { Wallet } from 'ethers';
import { task, types } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { cleanupJsonDb, getFirstSigner } from '../../helpers/misc-utils';

task('new-wallet', 'Generates a new wallet').setAction(async ({}, DRE) => {
  const w = Wallet.createRandom();
  console.log('New wallet');
  console.log('  Address:', w.address);
  console.log('       PK:', w.publicKey);
  console.log('       SK:', w.privateKey);
  console.log(' Menmonic:', w.mnemonic);
});

task('mnemonic-wallet', 'Prints a wallet by mnemonic')
  .addOptionalPositionalParam('mnemonic', '', undefined, types.string)
  .setAction(async ({ mnemonic }, DRE) => {
    const deployer = getFirstSigner(DRE);
    const w = Wallet.fromMnemonic(mnemonic);
    console.log('Wallet from mnemonic');
    console.log('  Address:', w.address);
    console.log('       PK:', w.publicKey);
    console.log('       SK:', w.privateKey);
    console.log(' Menmonic:', w.mnemonic);
  });
