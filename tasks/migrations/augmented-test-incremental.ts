import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import {
  cleanupJsonDb,
  cleanupUiConfig,
  getFirstSigner,
  getInstanceCountFromJsonDb,
  printContracts,
} from '../../helpers/misc-utils';
import { exit } from 'process';
import { tEthereumAddress } from '../../helpers/types';
import { getFullSteps } from '../helpers/full-steps';

task('augmented:test-incremental', 'Test incremental deploy').setAction(async ({}, DRE) => {
  const POOL_NAME = ConfigNames.Augmented;
  await DRE.run('set-DRE');
  await cleanupJsonDb(DRE.network.name);
  await cleanupUiConfig();

  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  if (!MAINNET_FORK) {
    console.log('Can only run on fork');
    exit(1);
  }

  try {
    let lastEntryMap = new Map<string, tEthereumAddress>();
    let lastInstanceCount = 0;
    let stop = false;
    const trackVerify = false;

    const steps = await getFullSteps({
      pool: POOL_NAME,
      verify: trackVerify,
    });

    for (let maxStep = 1; ; maxStep++) {
      if (maxStep > 1) {
        const [entryMap, instanceCount, multiCount] = printContracts((await getFirstSigner()).address);
        if (multiCount > 0) {
          throw `illegal multi-deployment detected after step ${maxStep}`;
        }
        if (lastInstanceCount > instanceCount || lastEntryMap.size > entryMap.size) {
          throw `impossible / jsonDb is broken after step ${maxStep}`;
        }
        if (!checkUnchanged(lastEntryMap, entryMap)) {
          throw `some contracts were redeployed after step ${maxStep}`;
        }
        entryMap.forEach((value, key, m) => {
          if (key.startsWith('Mock')) {
            throw 'mock contract(s) detected';
          }
        });

        lastInstanceCount = instanceCount;
        lastEntryMap = entryMap;
      }
      if (stop) {
        break;
      }

      console.log('======================================================================');
      console.log('======================================================================');
      console.log(`Incremental deploy cycle #${maxStep} started\n`);
      let step = maxStep;

      const isLastStep = () => {
        if (step == 2) {
          if (lastInstanceCount != getInstanceCountFromJsonDb()) {
            throw `unexpected contracts were deployed at step #${1 + maxStep - step}`;
          }
        }
        return --step == 0;
      };

      stop = true;
      for (const step of steps) {
        const stepId = '0' + step.seqId;
        console.log('\n======================================================================');
        console.log(stepId.substring(stepId.length - 2), step.stepName);
        console.log('======================================================================\n');
        await DRE.run(step.taskName, step.args);
        if (isLastStep()) {
          stop = false;
          break;
        }
      }
    }

    console.log('Smoke test');
    await DRE.run('full:smoke-test', { pool: POOL_NAME });

    console.log('Deposit test');
    await DRE.run('dev:pluck-tokens', { pool: POOL_NAME, mustDeposit: true });
  } catch (err) {
    console.error(err);
    exit(1);
  }

  await cleanupJsonDb(DRE.network.name);
});

const checkUnchanged = <T1, T2>(prev: Map<T1, T2>, next: Map<T1, T2>) => {
  let unchanged = true;
  prev.forEach((value, key, m) => {
    const nextValue = next.get(key);
    if (nextValue != value) {
      console.log(`${key} was changed: ${value} => ${nextValue}`);
      unchanged = false;
    }
  });
  return unchanged;
};
