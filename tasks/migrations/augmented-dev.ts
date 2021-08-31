import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { getFirstSigner, printContracts } from '../../helpers/misc-utils';

task('augmented:dev', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    const POOL_NAME = ConfigNames.Augmented;

    await localBRE.run('set-DRE');

    console.log('Deployment started\n');

    console.log('1. Deploy mock tokens');
    await localBRE.run('dev:deploy-mock-tokens', { verify });

    console.log('2. Deploy address provider');
    await localBRE.run('dev:deploy-address-provider', { verify });

    console.log('3. Deploy lending pool');
    await localBRE.run('dev:deploy-lending-pool', { verify });

    console.log('4. Deploy oracles');
    await localBRE.run('dev:deploy-oracles', { verify, pool: POOL_NAME });

    console.log('5. Initialize lending pool');
    await localBRE.run('dev:initialize-lending-pool', { verify, pool: POOL_NAME });

    console.log('\nFinished deployment');
    printContracts((await getFirstSigner()).address);
  });
