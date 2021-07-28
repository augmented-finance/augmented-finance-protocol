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

    for (let maxStep = 1; ; maxStep++) {
      if (maxStep > 1) {
        const [entryMap, instanceCount, multiCount] = printContracts(
          (await getFirstSigner()).address
        );
        if (multiCount > 0) {
          throw `illegal multi-deployment detected after step ${maxStep}`;
        }
        if (lastInstanceCount > instanceCount || lastEntryMap.size > entryMap.size) {
          throw `impossible / jsonDb is broken after step ${maxStep}`;
        }
        if (!checkUnchanged(lastEntryMap, entryMap)) {
          throw `some contracts were redeployed after step ${maxStep}`;
        }

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

      console.log('01. Deploy address provider registry');
      await DRE.run('full:deploy-address-provider', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('02. Deploy lending pool');
      await DRE.run('full:deploy-lending-pool', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('03. Deploy oracles');
      await DRE.run('full:deploy-oracles', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('04. Deploy Data Provider');
      await DRE.run('full:data-provider', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('05. Deploy WETH Gateway');
      await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('06. Initialize lending pool');
      await DRE.run('full:initialize-lending-pool', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('07. Deploy StakeConfigurator');
      await DRE.run('full:deploy-stake-configurator', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('08. Deploy and initialize stake tokens');
      await DRE.run('full:init-stake-tokens', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('09. Deploy reward contracts and AGF token');
      await DRE.run('full:deploy-reward-contracts', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      console.log('10. Deploy reward pools');
      await DRE.run('full:init-reward-pools', { pool: POOL_NAME });
      if (isLastStep()) {
        continue;
      }

      stop = true;
    }
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
