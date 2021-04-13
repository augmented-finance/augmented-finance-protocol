import { task } from 'hardhat/config';
import {
  deployAaveAdapter,
  deployAugmentedMigrator,
  deployCompAdapter,
} from '../../helpers/contracts-deployments';

// mainnet addresses
const ADAI_ADDRESS = '0x028171bca77440897b824ca71d1c56cac55b68a3';
const CDAI_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

task('dev:augmented-migrator', 'Deploy Augmented Migrator contracts.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const migrator = await deployAugmentedMigrator(verify);

    const aDaiMigrator = await deployAaveAdapter([ADAI_ADDRESS], verify);
    await aDaiMigrator.admin_setController(migrator.address);
    await migrator.registerAdapter(aDaiMigrator.address);

    const cDaiMigrator = await deployCompAdapter([CDAI_ADDRESS, DAI_ADDRESS], verify);
    await cDaiMigrator.admin_setController(migrator.address);
    await migrator.registerAdapter(cDaiMigrator.address);
  });
