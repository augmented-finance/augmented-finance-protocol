import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { ConfigNames } from '../../helpers/configuration';
import {
  cleanupJsonDb,
  getFirstSigner,
  getTenderlyDashboardLink,
  printContracts,
} from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { exit } from 'process';

task('augmented:mainnet', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    await DRE.run('set-DRE');
    await cleanupJsonDb(DRE.network.name);

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    try {
      console.log('Deployment started\n');

      console.log('01. Deploy address provider registry');
      await DRE.run('full:deploy-address-provider-registry', { pool: POOL_NAME });

      console.log('02. Deploy address provider');
      await DRE.run('full:deploy-address-provider', { pool: POOL_NAME });

      console.log('03. Deploy lending pool');
      await DRE.run('full:deploy-lending-pool', { pool: POOL_NAME });

      console.log('04. Deploy oracles');
      await DRE.run('full:deploy-oracles', { pool: POOL_NAME });

      console.log('05. Deploy Data Provider');
      await DRE.run('full:data-provider', { pool: POOL_NAME });

      console.log('06. Deploy WETH Gateway');
      await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });

      console.log('07. Initialize lending pool');
      await DRE.run('full:initialize-lending-pool', { pool: POOL_NAME });

      console.log('08. Deploy StakeConfigurator');
      await DRE.run('full:deploy-stake-configurator', { pool: POOL_NAME });

      console.log('09. Deploy and initialize stake tokens');
      await DRE.run('full:init-stake-tokens', { pool: POOL_NAME });

      console.log('10. Deploy reward contracts and AGF token');
      await DRE.run('full:deploy-reward-contracts', { pool: POOL_NAME });

      console.log('11. Deploy token reward pools');
      await DRE.run('full:init-token-reward-pools', { pool: POOL_NAME });

      if (verify) {
        printContracts((await getFirstSigner()).address);
        console.log('N-1. Veryfing contracts');
        await DRE.run('verify:general', { all: true, pool: POOL_NAME });

        console.log('N. Veryfing depositTokens and debtTokens');
        await DRE.run('verify:tokens', { pool: POOL_NAME });
      }
    } catch (err) {
      if (usingTenderly()) {
        console.error('Check tx error:', getTenderlyDashboardLink());
      }
      console.error(err);
      exit(1);
    }

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderlyNetwork.getHead();
      const postDeployFork = DRE.tenderlyNetwork.getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }

    console.log('\nFinished deployment');
    printContracts((await getFirstSigner()).address);
  });
