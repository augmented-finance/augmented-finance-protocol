import { task } from 'hardhat/config';
import {
  deployFlashLiquidationAdapter,
  deployProtocolDataProvider,
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
} from '../../helpers/contracts-deployments';
import { AccessFlags } from '../../helpers/access-flags';
import { falsyOrZeroAddress, getFirstSigner, mustWaitTx, waitTx } from '../../helpers/misc-utils';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';
import { eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';
import { LendingPoolConfigurator, MarketAccessController } from '../../types';
import { Contract } from '@ethersproject/contracts';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';

task('full:aux-contracts', 'Deploys auxiliary contracts (UI data provider, adapters etc)')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Dependencies } = poolConfig as ICommonConfiguration;
    const dependencies = getParamPerNetwork(Dependencies, network);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // ProtocolDataProvider is updated for existing installations
    let dhAddress = freshStart && continuation ? await addressProvider.getAddress(AccessFlags.DATA_HELPER) : '';

    if (falsyOrZeroAddress(dhAddress)) {
      const dataHelper = await deployProtocolDataProvider(addressProvider.address, verify);
      await mustWaitTx(addressProvider.setAddress(AccessFlags.DATA_HELPER, dataHelper.address));
      dhAddress = dataHelper.address;
    }
    console.log('Data helper:', dhAddress);

    await deployAllFlashloanAdapters(addressProvider, dependencies.UniswapV2Router, verify);
  });

const deployAllFlashloanAdapters = async (
  addressProvider: MarketAccessController,
  uniswapAddr: tEthereumAddress | undefined,
  verify: boolean
) => {
  const configurator = await getLendingPoolConfiguratorProxy(
    await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR)
  );

  if (!falsyOrZeroAddress(uniswapAddr)) {
    await deployFlashloanAdapters(
      addressProvider,
      configurator,
      {
        UniswapLiquiditySwapAdapter: deployUniswapLiquiditySwapAdapter,
        UniswapRepayAdapter: deployUniswapRepayAdapter,
        UniswapLiquidationAdapter: deployFlashLiquidationAdapter,
      },
      [addressProvider.address, uniswapAddr!],
      verify
    );
  }
};

const deployFlashloanAdapters = async <T>(
  addressProvider: MarketAccessController,
  configurator: LendingPoolConfigurator,
  deployList: { [key: string]: (args: T, verify?: boolean) => Promise<Contract> },
  args: T,
  verify: boolean
) => {
  const adapterDeploys: ((args: T, verify?: boolean) => Promise<Contract>)[] = [];
  const adapterNames: string[] = [];

  for (const [key, dep] of Object.entries(deployList)) {
    adapterDeploys.push(dep);
    adapterNames.push(key);
  }

  const newAdapters: tEthereumAddress[] = [];
  const newNames: string[] = [];

  const deployedAdapters = await configurator.getFlashloanAdapters(adapterNames);

  for (let i = 0; i < adapterDeploys.length; i++) {
    let adapterAddr = deployedAdapters[i];
    if (falsyOrZeroAddress(adapterAddr)) {
      adapterAddr = (await adapterDeploys[i](args, verify)).address;
      newAdapters.push(adapterAddr);
      newNames.push(adapterNames[i]);
      console.log('Flashloan adapter deployed', adapterNames[i], adapterAddr);
    } else {
      console.log('Flashloan adapter found', adapterNames[i], adapterAddr);
    }
  }

  if (newAdapters.length > 0) {
    await grantPoolAdmin(addressProvider);
    await mustWaitTx(configurator.setFlashloanAdapters(newNames, newAdapters));
    console.log('Flashloan adapter(s) registered: ', newNames);
  }
};

const grantPoolAdmin = async (addressProvider: MarketAccessController) => {
  const deployer = (await getFirstSigner()).address;
  if (await addressProvider.isAddress(AccessFlags.POOL_ADMIN, deployer)) {
    return;
  }
  await mustWaitTx(addressProvider.grantRoles(deployer, AccessFlags.POOL_ADMIN));
  console.log('Granted POOL_ADMIN');
};
