import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ConfigNames } from '../../helpers/configuration';
import { verifyContract, checkEtherscanVerification } from '../../helpers/etherscan-verification';
import { getExternalsFromJsonDb, getInstancesFromJsonDb } from '../../helpers/misc-utils';

task('verify:verify-all-contracts', 'Use JsonDB to perform verification')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');

    // checkEtherscanVerification();

    for (const [key, entry] of getInstancesFromJsonDb()) {
      console.log(entry.id, key);
    }

    for (const [key, entry] of getExternalsFromJsonDb()) {
      console.log(entry.id, key);
    }

    // const result = await verifyContract(address, constructorArguments, libraries);
    // return result;
  });
