import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployAGFTokenV1Impl,
  deployRewardBoosterV1Impl,
  deployRewardConfiguratorImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import {
  getAGFTokenV1Impl,
  getRewardBooster,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { getFirstSigner, falsyOrZeroAddress, waitTx, mustWaitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import {
  getDeployAccessController,
  setAndGetAddressAsProxy,
  setAndGetAddressAsProxyWithInit,
} from '../../helpers/deploy-helpers';

task(`full:deploy-reward-contracts`, `Deploys reward contracts, AGF and xAGF tokens`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names } = poolConfig as ICommonConfiguration;

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // configurator is always updated
    let configuratorAddr =
      freshStart && continuation
        ? await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR)
        : '';

    if (falsyOrZeroAddress(configuratorAddr)) {
      const impl = await deployRewardConfiguratorImpl(verify, continuation);
      console.log('Deployed RewardConfigurator implementation:', impl.address);
      configuratorAddr = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.REWARD_CONFIGURATOR,
        impl.address
      );
    }
    const configurator = await getRewardConfiguratorProxy(configuratorAddr);

    // AGF token is always updated
    let agfAddr =
      freshStart && continuation ? await addressProvider.getAddress(AccessFlags.REWARD_TOKEN) : '';

    if (falsyOrZeroAddress(agfAddr)) {
      const initData = await configurator.buildRewardTokenInitData(
        Names.RewardTokenName,
        Names.RewardTokenSymbol,
        18
      );
      const impl = await deployAGFTokenV1Impl(verify, continuation);
      console.log('Deployed AGF token implementation:', impl.address);
      agfAddr = await setAndGetAddressAsProxyWithInit(
        addressProvider,
        AccessFlags.REWARD_TOKEN,
        impl.address,
        initData
      );
      console.log('AGF token:', agfAddr);

      const agf = await getAGFTokenV1Impl(agfAddr);
      console.log('\t', await agf.name(), await agf.symbol(), await agf.decimals());
    } else {
      console.log('AGF token:', agfAddr);
    }

    // Reward controller is not updated
    let boosterAddr =
      freshStart && !continuation
        ? ''
        : await addressProvider.getAddress(AccessFlags.REWARD_CONTROLLER);

    if (falsyOrZeroAddress(boosterAddr)) {
      const impl = await deployRewardBoosterV1Impl(verify, continuation);
      console.log('Deployed RewardBooster implementation:', impl.address);
      boosterAddr = await setAndGetAddressAsProxy(
        addressProvider,
        AccessFlags.REWARD_CONTROLLER,
        impl.address
      );
    }
    console.log('RewardBooster', boosterAddr);
    const booster = await getRewardBooster(boosterAddr);

    // xAGF token is always updated
    let xagfAddr =
      freshStart && continuation
        ? await addressProvider.getAddress(AccessFlags.REWARD_STAKE_TOKEN)
        : '';

    if (falsyOrZeroAddress(xagfAddr)) {
      const xagfInitData = await configurator.buildRewardTokenInitData(
        Names.RewardStakeTokenName,
        Names.RewardStakeTokenSymbol,
        18
      );

      const impl = await deployXAGFTokenV1Impl(verify, continuation);
      console.log('Deployed xAGF token implementation:', impl.address);

      xagfAddr = await setAndGetAddressAsProxyWithInit(
        addressProvider,
        AccessFlags.REWARD_STAKE_TOKEN,
        impl.address,
        xagfInitData
      );
      console.log('xAGF token:', xagfAddr);

      const xagf = await getAGFTokenV1Impl(xagfAddr);
      console.log('\t', await xagf.name(), await xagf.symbol(), await xagf.decimals());

      xagfAddr = xagf.address;
    } else {
      console.log('xAGF token:', xagfAddr);
    }

    if (freshStart && (!continuation || falsyOrZeroAddress((await booster.getBoostPool()).pool))) {
      await waitTx(
        addressProvider.grantRoles(
          (await getFirstSigner()).address,
          AccessFlags.REWARD_CONFIG_ADMIN
        )
      );
      console.log('Granted REWARD_CONFIG_ADMIN');

      await mustWaitTx(
        configurator.configureRewardBoost(xagfAddr, true, xagfAddr, false, {
          gasLimit: 2000000,
        })
      );
      console.log('Boost pool and excess recevier: ', xagfAddr);
    }
  });
