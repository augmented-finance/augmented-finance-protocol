import { task } from 'hardhat/config';
import {
  deployLendingPoolExtensionImpl,
  deployLendingPoolConfiguratorImpl,
  deployLendingPoolImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration, LPFeature } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner, waitTx } from '../../helpers/misc-utils';
import { getIManagedLendingPool, getLendingPoolProxy } from '../../helpers/contracts-getters';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { addFullStep } from '../helpers/full-steps';

addFullStep(3, 'Deploy lending pool', 'full:deploy-lending-pool');

task('full:deploy-lending-pool', 'Deploys lending pool')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { LendingDisableFeatures } = poolConfig as ICommonConfiguration;
    const disableFeatures = getParamPerNetwork(LendingDisableFeatures, network);

    const deployer = await getFirstSigner();
    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // LendingPool will be updated for existing installations
    let lpAddress = freshStart && continuation ? await addressProvider.getLendingPool() : '';
    const newLendingPool = falsyOrZeroAddress(lpAddress);

    if (newLendingPool) {
      console.log('\tDeploying lending pool...');
      const lendingPoolImpl = await deployLendingPoolImpl(verify, continuation);
      console.log('\tLending pool implementation:', lendingPoolImpl.address);
      lpAddress = await setAndGetAddressAsProxy(addressProvider, AccessFlags.LENDING_POOL, lendingPoolImpl.address);
    }

    const lendingPoolProxy = await getLendingPoolProxy(lpAddress);
    console.log('Lending pool:', lpAddress);

    let lpExt = newLendingPool ? '' : await lendingPoolProxy.getLendingPoolExtension();
    if (falsyOrZeroAddress(lpExt)) {
      console.log('\tDeploying lending pool extension...');
      const poolExtension = await deployLendingPoolExtensionImpl(verify, continuation);
      await waitTx(addressProvider.grantRoles(await deployer.getAddress(), AccessFlags.POOL_ADMIN));
      await waitTx(lendingPoolProxy.setLendingPoolExtension(poolExtension.address));
      lpExt = poolExtension.address;
    }
    console.log('Lending pool extension:', lpExt);

    {
      let featureMask = 0;
      const features: string[] = [];
      disableFeatures.forEach((value) => {
        if (value != 0) {
          featureMask |= value;
          features.push(LPFeature[value]);
        }
      });
      if (featureMask > 0) {
        console.log(`Disable lending pool features: 0x${featureMask.toString(16)} [${features.join(', ')}]`);
        const lp = await getIManagedLendingPool(lpAddress);
        await waitTx(lp.setDisabledFeatures(featureMask));
      }
    }

    let lpConfigurator = newLendingPool ? '' : await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR);

    if (falsyOrZeroAddress(lpConfigurator)) {
      console.log('\tDeploying configurator...');
      const lendingPoolConfiguratorImpl = await deployLendingPoolConfiguratorImpl(verify, continuation);
      console.log('\tLending pool configurator implementation:', lendingPoolConfiguratorImpl.address);

      lpConfigurator = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.LENDING_POOL_CONFIGURATOR,
        lendingPoolConfiguratorImpl.address
      );
    }

    console.log('Lending pool configurator:', lpConfigurator);
  });
