import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { ConfigNames } from '../../helpers/configuration';
import { printContracts } from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';

task('augmented:mainnet', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    await DRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Deployment started\n');

    console.log('0. Deploy address provider registry');
    await DRE.run('full:deploy-address-provider-registry', { pool: POOL_NAME });

    console.log('1. Deploy address provider');
    await DRE.run('full:deploy-address-provider', { pool: POOL_NAME });

    console.log('2. Deploy lending pool');
    await DRE.run('full:deploy-lending-pool', { pool: POOL_NAME });

    console.log('3. Deploy oracles');
    await DRE.run('full:deploy-oracles', { pool: POOL_NAME });

    console.log('4. Deploy Data Provider');
    await DRE.run('full:data-provider', { pool: POOL_NAME });

    console.log('5. Deploy WETH Gateway');
    await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });

    console.log('6. Initialize lending pool');
    await DRE.run('full:initialize-lending-pool', { pool: POOL_NAME });

    console.log('7. Deploy StakeConfigurator');
    await DRE.run('full:deploy-stake-configurator', { pool: POOL_NAME });

    console.log('8. Deploy and initialize stake tokens');
    await DRE.run('full:init-stake-tokens', { pool: POOL_NAME });

    if (verify) {
      printContracts();
      console.log('N-1. Veryfing contracts');
      await DRE.run('verify:general', { all: true, pool: POOL_NAME });

      console.log('N. Veryfing depositTokens and debtTokens');
      await DRE.run('verify:tokens', { pool: POOL_NAME });
    }

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderlyNetwork.getHead();
      const postDeployFork = DRE.tenderlyNetwork.getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
    console.log('\nFinished deployment');
    printContracts();
  });
