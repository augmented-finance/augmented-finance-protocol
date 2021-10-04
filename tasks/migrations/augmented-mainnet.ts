import { task, types } from 'hardhat/config';
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
import { BigNumber } from 'ethers';
import { getDeploySteps } from '../helpers/deploy-steps';

task('augmented:mainnet', 'Deploy enviroment')
  .addFlag('incremental', 'Incremental deployment')
  .addFlag('secure', 'Renounce credentials on errors')
  .addFlag('strict', 'Fail on warnings')
  .addFlag('ignorecalc', 'Ignore APY calc during smoke test')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addOptionalParam('skip', 'Skip steps with less or equal index', 0, types.int)
  .setAction(async ({ incremental, secure, strict, verify, skip: skipN, ignorecalc: ignoreCalc }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
    await DRE.run('set-DRE');

    const deployer = await getFirstSigner();
    // if (MAINNET_FORK) {
    //   await DRE.ethers.provider.send("hardhat_setBalance", [
    //     deployer.address,
    //     "0x56BC75E2D63100000", // 10^20
    //   ]);
    // }

    const startBalance: BigNumber = await deployer.getBalance();
    let spentOnPluck: BigNumber = BigNumber.from(0);

    let renounce = false;
    let success = false;

    try {
      await cleanupUiConfig();
      console.log('Deployer start balance: ', startBalance.div(1e12).toNumber() / 1e6);

      if (incremental) {
        console.log('======================================================================');
        console.log('======================================================================');
        console.log('====================    ATTN! INCREMENTAL MODE    ====================');
        console.log('======================================================================');
        console.log(`=========== Delete 'deployed-contracts.json' to start anew ===========`);
        console.log('======================================================================');
        console.log('======================================================================');
      } else {
        await cleanupJsonDb(DRE.network.name);
        renounce = secure;
      }

      console.log('Deployment started\n');
      const trackVerify = true;

      for (const step of await getDeploySteps('full', {
        pool: POOL_NAME,
        verify: trackVerify,
      })) {
        const stepId = '0' + step.seqId;
        console.log('\n======================================================================');
        console.log(stepId.substring(stepId.length - 2), step.stepName);
        console.log('======================================================================\n');
        if (step.seqId <= skipN) {
          console.log('STEP WAS SKIPPED\n');
          continue;
        }
        await DRE.run(step.taskName, step.args);
      }

      console.log('\n======================================================================');
      console.log('96 Access test');
      console.log('======================================================================\n');
      await DRE.run('full:access-test', { pool: POOL_NAME });

      const balanceBeforePluck = await deployer.getBalance();
      if (MAINNET_FORK) {
        console.log('\n======================================================================');
        console.log('97 Pluck');
        console.log('======================================================================\n');
        await DRE.run('dev:pluck-tokens', { pool: POOL_NAME });
      }
      spentOnPluck = balanceBeforePluck.sub(await deployer.getBalance());

      console.log('\n======================================================================');
      console.log('98 Smoke tests');
      console.log('======================================================================\n');
      await DRE.run('full:smoke-test', { pool: POOL_NAME, ignoreCalc });

      {
        const [entryMap, instanceCount, multiCount] = printContracts((await getFirstSigner()).address);

        let hasWarn = false;
        if (multiCount > 0) {
          console.error('WARNING: multi-deployed contract(s) detected');
          hasWarn = true;
        } else if (entryMap.size != instanceCount) {
          console.error('WARNING: unknown contract(s) detected');
          hasWarn = true;
        }

        entryMap.forEach((value, key, m) => {
          if (key.startsWith('Mock')) {
            console.error('WARNING: mock contract detected:', key);
            hasWarn = true;
          }
        });

        if (hasWarn && strict) {
          throw 'warnings are present';
        }
      }

      renounce = true;
      success = true;
    } catch (err) {
      if (usingTenderly()) {
        console.error('Check tx error:', getTenderlyDashboardLink());
      }
      console.error('\n=========================================================\nERROR:', err, '\n');
    }

    if (renounce || success) {
      try {
        console.log('\n======================================================================');
        console.log('99. Finalize');
        console.log('======================================================================\n');
        await DRE.run('full:deploy-finalize', { pool: POOL_NAME, register: success });
      } catch (err) {
        console.log('Error during finalization & renouncement');
        console.error(err);
      }
    }

    {
      const endBalance = await deployer.getBalance();
      console.log('======================================================================');
      console.log('Deployer end balance: ', endBalance.div(1e12).toNumber() / 1e6);
      console.log('Deploy expenses: ', startBalance.sub(endBalance).div(1e12).toNumber() / 1e6);
      const gasPrice = DRE.network.config.gasPrice;
      if (gasPrice != 'auto') {
        console.log(
          'Deploy gas     : ',
          startBalance.sub(endBalance).sub(spentOnPluck).div(gasPrice).toNumber(),
          '@',
          gasPrice / 1e9,
          ' gwei'
        );
      }
      console.log('======================================================================');
    }

    if (!success) {
      console.log('\nDeployment has failed');
      exit(1);
    }

    console.log('Write UI config');
    await DRE.run('full:write-ui-config', { pool: POOL_NAME });

    console.log('\nDeployment has finished');

    if (usingTenderly()) {
      const postDeployHead = (<any>DRE).tenderlyNetwork.getHead();
      const postDeployFork = (<any>DRE).tenderlyNetwork.getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }

    if (verify) {
      console.log('N. Verify all contracts');
      await DRE.run('verify:verify-all-contracts', { pool: POOL_NAME });
    }
  });
