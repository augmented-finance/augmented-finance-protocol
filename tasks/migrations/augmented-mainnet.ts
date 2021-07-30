import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { ConfigNames } from '../../helpers/configuration';
import {
  cleanupJsonDb,
  cleanupUiConfig,
  getFirstSigner,
  getTenderlyDashboardLink,
  printContracts,
} from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { exit } from 'process';

task('augmented:mainnet', 'Deploy enviroment')
  .addFlag('incremental', 'Incremental installation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ incremental, verify }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    const MAINNET_FORK = process.env.MAINNET_FORK === 'true';

    await DRE.run('set-DRE');

    let renounce = true;
    if (incremental) {
      console.log('======================================================================');
      console.log('======================================================================');
      console.log('====================    ATTN! INCREMENTAL MODE    ====================');
      console.log('======================================================================');
      console.log(`=========== Delete 'deployed-contracts.json' to start anew ===========`);
      console.log('======================================================================');
      console.log('======================================================================');
      renounce = false;
    } else {
      await cleanupJsonDb(DRE.network.name);
    }
    await cleanupUiConfig();

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    let success = false;

    try {
      console.log('Deployment started\n');

      console.log('01. Deploy address provider registry');
      await DRE.run('full:deploy-address-provider', { pool: POOL_NAME });

      console.log('02. Deploy lending pool');
      await DRE.run('full:deploy-lending-pool', { pool: POOL_NAME });

      console.log('03. Deploy oracles');
      await DRE.run('full:deploy-oracles', { pool: POOL_NAME });

      console.log('04. Deploy Data Provider');
      await DRE.run('full:data-provider', { pool: POOL_NAME });

      console.log('05. Deploy WETH Gateway');
      await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });

      console.log('06. Initialize lending pool');
      await DRE.run('full:initialize-lending-pool', { pool: POOL_NAME });

      console.log('07. Deploy StakeConfigurator');
      await DRE.run('full:deploy-stake-configurator', { pool: POOL_NAME });

      console.log('08. Deploy and initialize stake tokens');
      await DRE.run('full:init-stake-tokens', { pool: POOL_NAME });

      console.log('09. Deploy reward contracts and AGF token');
      await DRE.run('full:deploy-reward-contracts', { pool: POOL_NAME });

      console.log('10. Deploy reward pools');
      await DRE.run('full:init-reward-pools', { pool: POOL_NAME });

      if (MAINNET_FORK) {
        console.log('Pluck');
        await DRE.run('dev:pluck-tokens', { pool: POOL_NAME });
      }

      if (verify) {
        printContracts((await getFirstSigner()).address);
        console.log('N-1. Veryfing contracts');
        await DRE.run('verify:general', { all: true, pool: POOL_NAME });

        console.log('N. Veryfing depositTokens and debtTokens');
        await DRE.run('verify:tokens', { pool: POOL_NAME });
      }

      renounce = true;

      const [entryMap, instanceCount, multiCount] = printContracts(
        (await getFirstSigner()).address
      );

      if (multiCount > 0) {
        throw 'multi-deployed contract(s) detected';
      }
      if (entryMap.size != instanceCount) {
        throw 'unknown contract(s) detected';
      }
      entryMap.forEach((value, key, m) => {
        if (key.startsWith('Mock')) {
          throw 'mock contract(s) detected';
        }
      });

      success = true;
    } catch (err) {
      if (usingTenderly()) {
        console.error('Check tx error:', getTenderlyDashboardLink());
      }
      console.error(
        '\n=========================================================\nERROR:',
        err,
        '\n'
      );
    }

    if (renounce) {
      try {
        console.log('99. Finalize');
        await DRE.run('full:deploy-finalize', { pool: POOL_NAME });
      } catch (err) {
        console.log('Error during finalization & renouncement');
        console.error(err);
      }
    }

    if (!success) {
      exit(1);
    }

    console.log('Write UI config');
    await DRE.run('full:write-ui-config', { pool: POOL_NAME });

    if (usingTenderly()) {
      const postDeployHead = (<any>DRE).tenderlyNetwork.getHead();
      const postDeployFork = (<any>DRE).tenderlyNetwork.getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }

    console.log('\nFinished deployment');
    //    await cleanupJsonDb(DRE.network.name);
  });
