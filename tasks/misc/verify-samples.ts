import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { cleanupJsonDb, getFirstSigner } from '../../helpers/misc-utils';

task('augmented:verify-samples', 'Deploy samples for verification').setAction(async ({}, DRE) => {
  const POOL_NAME = ConfigNames.Augmented;
  await DRE.run('set-DRE');

  const deployer = await getFirstSigner();

  await cleanupJsonDb(DRE.network.name);
  await DRE.run('dev:deploy-samples');

  console.log('Verify all contracts');
  await DRE.run('verify:verify-all-contracts', { pool: POOL_NAME });
});
