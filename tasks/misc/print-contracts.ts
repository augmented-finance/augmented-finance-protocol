import { task } from 'hardhat/config';
import { getFirstSigner, printContracts } from '../../helpers/misc-utils';

task('print-contracts').setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');
  printContracts((await getFirstSigner()).address);
});
