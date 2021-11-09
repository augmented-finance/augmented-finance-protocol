import { loadPoolConfig } from '../../helpers/configuration';
import {
  deployAGFTokenImpl,
  deployRewardBoosterV1Impl,
  deployRewardConfiguratorImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';
import { eContractid, eNetwork, ePolygonNetwork, ICommonConfiguration } from '../../helpers/types';
import {
  getAGFTokenImpl,
  getOracleRouter,
  getProxyAdmin,
  getRewardBooster,
  getRewardConfiguratorProxy,
  getStaticPriceOracle,
  getXAGFTokenV1Impl,
} from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, waitTx, mustWaitTx, addContractAddrToJsonDb } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import {
  getDeployAccessController,
  setAndGetAddressAsProxy,
  setAndGetAddressAsProxyWithInit,
} from '../../helpers/deploy-helpers';
import { oneEther, WEEK } from '../../helpers/constants';
import { MarketAccessController } from '../../types';
import { BigNumber } from '@ethersproject/bignumber';
import { deployTask } from '../helpers/deploy-steps';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployUniAgfEth } from '../../helpers/init-helpers';

deployTask(`full:deploy-reward-contracts`, `Deploy reward contracts, AGF and xAGF tokens`, __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      Names,
      RewardParams,
      Dependencies,
      AGF: { DefaultPriceEth: AgfDefaultPriceEth, UniV2EthPair },
    } = poolConfig as ICommonConfiguration;

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    // configurator is always updated
    let configuratorAddr =
      freshStart && continuation ? await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR) : '';

    if (falsyOrZeroAddress(configuratorAddr)) {
      console.log('Deploying RewardConfigurator');
      const impl = await deployRewardConfiguratorImpl(verify, continuation);
      console.log('Deployed RewardConfigurator implementation:', impl.address);
      configuratorAddr = await setAndGetAddressAsProxy(addressProvider, AccessFlags.REWARD_CONFIGURATOR, impl.address);
    }
    const configurator = await getRewardConfiguratorProxy(configuratorAddr);

    {
      console.log(`Check proxy admin`);
      const sc = configurator;
      const pa = await sc.getProxyAdmin();
      if (falsyOrZeroAddress(pa)) {
        throw new Error('Missing proxy admin');
      } else {
        const padm = await getProxyAdmin(pa);
        const owner = await padm.owner();
        if (owner != sc.address) {
          throw new Error(`Invalid proxy admin owner: ${owner}, ${sc.address}`);
        }
        if (verify) {
          await addContractAddrToJsonDb(
            eContractid.ProxyAdmin + '-' + eContractid.StakeConfiguratorImpl,
            pa,
            false,
            []
          );
        }
      }
    }

    // AGF token is always updated
    let agfAddr = freshStart && continuation ? await addressProvider.getAddress(AccessFlags.REWARD_TOKEN) : '';
    let newAgfToken = false;

    if (falsyOrZeroAddress(agfAddr)) {
      console.log('Deploying AGF token');
      const initData = await configurator.buildRewardTokenInitData(Names.RewardTokenName, Names.RewardTokenSymbol, 18);
      const impl = await deployAGFTokenImpl(verify, continuation);
      console.log('Deployed AGF token implementation:', impl.address);
      agfAddr = await setAndGetAddressAsProxyWithInit(
        addressProvider,
        AccessFlags.REWARD_TOKEN,
        impl.address,
        initData
      );
      console.log('AGF token:', agfAddr);

      const agf = await getAGFTokenImpl(agfAddr);
      console.log('\t', await agf.name(), await agf.symbol(), await agf.decimals());
      newAgfToken = true;
    } else {
      console.log('AGF token:', agfAddr);
    }

    if (AgfDefaultPriceEth) {
      await configureAgfPrice(addressProvider, agfAddr, AgfDefaultPriceEth, newAgfToken);
    }

    if (UniV2EthPair) {
      const dependencies = getParamPerNetwork(Dependencies, network);
      await deployUniAgfEth(addressProvider, agfAddr, dependencies.UniswapV2Router, newAgfToken);
    }

    // Reward controller is not updated
    let boosterAddr =
      freshStart && !continuation ? '' : await addressProvider.getAddress(AccessFlags.REWARD_CONTROLLER);

    if (falsyOrZeroAddress(boosterAddr)) {
      console.log('Deploying RewardBooster');
      const impl = await deployRewardBoosterV1Impl(verify, continuation);
      console.log('Deployed RewardBooster implementation:', impl.address);
      boosterAddr = await setAndGetAddressAsProxy(addressProvider, AccessFlags.REWARD_CONTROLLER, impl.address);
    }
    console.log('RewardBooster', boosterAddr);
    const booster = await getRewardBooster(boosterAddr);

    if (RewardParams.Autolock == 'disable') {
      console.log('\tAutolock disabled');
    } else if (!(await booster.isAutolockEnabled())) {
      if (RewardParams.Autolock == 'stop') {
        console.log('\tAutolock default mode: stop');
        // AutolockMode.Stop
        await waitTx(booster.enableAutolockAndSetDefault(1, 0, 0));
      } else {
        console.log('\tAutolock default mode: prolongate for ', RewardParams.Autolock, 'week(s)');
        // AutolockMode.Prolongate
        await waitTx(booster.enableAutolockAndSetDefault(2, RewardParams.Autolock * WEEK, 0));
      }
    }

    if (RewardParams.MinBoostBP > 0) {
      console.log('\tMin boost: ', RewardParams.MinBoostBP / 100, '%');
      await waitTx(booster.setMinBoost(RewardParams.MinBoostBP));
    }

    // xAGF token is always updated
    let xagfAddr = freshStart && continuation ? await addressProvider.getAddress(AccessFlags.REWARD_STAKE_TOKEN) : '';

    if (falsyOrZeroAddress(xagfAddr)) {
      console.log('Deploying xAGF');

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

      const xagf = await getXAGFTokenV1Impl(xagfAddr);
      console.log('\t', await xagf.name(), await xagf.symbol(), await xagf.decimals());

      xagfAddr = xagf.address;
    } else {
      console.log('xAGF token:', xagfAddr);
    }

    if (freshStart && (!continuation || falsyOrZeroAddress((await booster.getBoostPool()).pool))) {
      await mustWaitTx(
        configurator.configureRewardBoost(xagfAddr, true, xagfAddr, false, {
          gasLimit: Object.values(ePolygonNetwork).includes(<ePolygonNetwork>network) ? undefined : 2000000,
        })
      );
      console.log('Boost pool: ', xagfAddr);
    }
  }
);

const configureAgfPrice = async (
  addressProvider: MarketAccessController,
  agfAddr: string,
  defaulAgfPrice: number,
  newAgfToken: boolean
) => {
  console.log('Configuring default price feed for AGF');
  // newAgfToken
  const oracle = await getOracleRouter(await addressProvider.getAddress(AccessFlags.PRICE_ORACLE));
  let hasPrice = false;
  let price: BigNumber = BigNumber.from(0);
  if (!newAgfToken) {
    try {
      price = await oracle.getAssetPrice(agfAddr);
      hasPrice = true;
    } catch {}
  }
  if (hasPrice) {
    console.log('AGF price found:', price.div(1e9).toNumber() / 1e9, 'ethers, (', price.toString(), ' wei)');
  } else {
    const agfPrice = oneEther.multipliedBy(defaulAgfPrice).toFixed(0);
    const fallback = await getStaticPriceOracle(await oracle.getFallbackOracle());

    await waitTx(fallback.setAssetPrice(agfAddr, agfPrice));
    console.log('AGF price configured:', defaulAgfPrice, 'ethers (', agfPrice, ')');
  }
};
