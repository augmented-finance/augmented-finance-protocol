import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ConfigNames } from '../../helpers/configuration';
import {
  checkEtherscanVerification,
  verifyContractStringified,
} from '../../helpers/etherscan-verification';
import {
  DbInstanceEntry,
  getExternalsFromJsonDb,
  getInstancesFromJsonDb,
} from '../../helpers/misc-utils';

task('verify:verify-all-contracts', 'Use JsonDB to perform verification')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');

    checkEtherscanVerification();

    for (const [key, entry] of getInstancesFromJsonDb()) {
      await verifyEntry(key, entry);
    }

    for (const [key, entry] of getExternalsFromJsonDb()) {
      await verifyEntry(key, entry);
    }
  });

const verifyEntry = async (addr: string, entry: DbInstanceEntry) => {
  if (!entry.verify) {
    return;
  }

  const params = entry.verify!;
  if (params.impl) {
    console.log('\tProxy:   ', entry.id, addr);
    // TODO verify proxy
    return;
  }
  console.log('\tContract:', entry.id, addr, params.args);
  await verifyContractStringified(addr, entry.verify.args || '');
};
