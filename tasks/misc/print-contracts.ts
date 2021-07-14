import { task } from 'hardhat/config';
import { getFirstSigner, printContracts } from '../../helpers/misc-utils';

task('print-contracts', 'Inits the DRE, to have access to all the plugins').setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-DRE');
    printContracts((await getFirstSigner()).address);
  }
);
