import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployAGFTokenV1Impl,
  deployRewardBooster,
  deployRewardConfiguratorImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import {
  getAGFTokenV1Impl,
  getMarketAddressController,
  getRewardConfiguratorProxy,
  getRewardBooster,
} from '../../helpers/contracts-getters';
import { getFirstSigner, falsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

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
      freshStart && continuation ? await addressProvider.getRewardConfigurator() : '';

    if (falsyOrZeroAddress(configuratorAddr)) {
      const impl = await deployRewardConfiguratorImpl(verify, continuation);
      console.log('Deployed RewardConfigurator implementation:', impl.address);
      await waitForTx(await addressProvider.setRewardConfiguratorImpl(impl.address));
      configuratorAddr = await addressProvider.getRewardConfigurator();
    }
    const configurator = await getRewardConfiguratorProxy(configuratorAddr);

    // AGF token is always updated
    let agfAddr = freshStart && continuation ? await addressProvider.getRewardToken() : '';

    if (falsyOrZeroAddress(agfAddr)) {
      const initData = await configurator.buildRewardTokenInitData(
        Names.RewardTokenName,
        Names.RewardTokenSymbol,
        18
      );
      const impl = await deployAGFTokenV1Impl(verify, continuation);
      console.log('Deployed AGF token implementation:', impl.address);
      await addressProvider.setAddressAsProxyWithInit(
        AccessFlags.REWARD_TOKEN,
        impl.address,
        initData
      );

      const agf = await getAGFTokenV1Impl(await addressProvider.getRewardToken());
      console.log(
        'AGF token:',
        agf.address,
        await agf.name(),
        await agf.symbol(),
        await agf.decimals()
      );

      agfAddr = agf.address;
    } else {
      console.log('AGF token:', agfAddr);
    }

    // Reward controller is not updated
    let boosterAddr =
      freshStart && !continuation ? '' : await addressProvider.getRewardController();

    if (falsyOrZeroAddress(boosterAddr)) {
      const impl = await deployRewardBooster([addressProvider.address, agfAddr], verify);
      console.log('Deployed RewardBooster implementation:', impl.address);
      await waitForTx(await addressProvider.setRewardController(impl.address));
      boosterAddr = await addressProvider.getRewardController();
    }
    console.log('RewardBooster', boosterAddr);
    const booster = await getRewardBooster(boosterAddr);

    // xAGF token is always updated
    let xagfAddr = freshStart && continuation ? await addressProvider.getRewardStakeToken() : '';

    if (falsyOrZeroAddress(xagfAddr)) {
      const xagfInitData = await configurator.buildRewardTokenInitData(
        Names.RewardStakeTokenName,
        Names.RewardStakeTokenSymbol,
        18
      );

      const impl = await deployXAGFTokenV1Impl(verify, continuation);
      console.log('Deployed xAGF token implementation:', impl.address);

      await addressProvider.setAddressAsProxyWithInit(
        AccessFlags.REWARD_STAKE_TOKEN,
        impl.address,
        xagfInitData
      );
      const xagf = await getAGFTokenV1Impl(await addressProvider.getRewardStakeToken());

      console.log(
        'xAGF token: ',
        xagf.address,
        await xagf.name(),
        await xagf.symbol(),
        await xagf.decimals()
      );

      xagfAddr = xagf.address;
    } else {
      console.log('xAGF token:', xagfAddr);
    }

    if (freshStart && (!continuation || falsyOrZeroAddress((await booster.getBoostPool()).pool))) {
      await addressProvider.grantRoles(
        (await getFirstSigner()).address,
        AccessFlags.REWARD_CONFIG_ADMIN
      );

      await waitForTx(await configurator.configureRewardBoost(xagfAddr, true, xagfAddr, false));
      console.log('Boost pool and excess recevier: ', xagfAddr);
    }
  });
