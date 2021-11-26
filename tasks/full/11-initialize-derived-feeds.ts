import { BigNumberish } from 'ethers';

import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig } from '../../helpers/configuration';
import { ICommonConfiguration } from '../../helpers/types';
import { getUniAgfEth, initReservePriceFeeds } from '../../helpers/init-helpers';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';
import { deployPriceFeedUniEthToken } from '../../helpers/contracts-deployments';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { getOracleRouter } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { WAD } from '../../helpers/constants';

const QUOTES: Record<string, BigNumberish> = {
  WETH: WAD,
};

deployTask('full:initialize-derived-feeds', 'Initialize derived feeds', __dirname).setAction(
  async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      PriceOracle,
      ReservesConfig,
      Mocks: { UnderlyingMappings },
    } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets);
    const underlyingMappings = getParamPerNetwork(UnderlyingMappings);
    const priceOracleConfig = getParamPerNetwork(PriceOracle);
    const reservesConfig = getParamPerNetwork(ReservesConfig);
    const dependencies = getParamPerNetwork(poolConfig.Dependencies);
    const [, , addressProvider] = await getDeployAccessController();
    const priceBaseSymbol = dependencies.AgfPair ?? dependencies.WrappedNative ?? 'WETH';
    const pairPriceBaseToken = reserveAssets[priceBaseSymbol];

    const [priceOracle, lpPairAddress] = await Promise.all([
      getOracleRouter(await addressProvider.getPriceOracle()),
      getUniAgfEth(addressProvider, dependencies.UniswapV2Router, pairPriceBaseToken),
    ]);
    const agfAddress = await addressProvider.getAddress(AccessFlags.REWARD_TOKEN);
    const source = await priceOracle.getSourceOfAsset(agfAddress);

    if (falsyOrZeroAddress(source)) {
      const uniAGFPriceFeed = await deployPriceFeedUniEthToken(
        `AGF-${priceBaseSymbol}`,
        [
          lpPairAddress,
          pairPriceBaseToken,
          typeof priceOracleConfig === 'string'
            ? QUOTES[priceOracleConfig] ?? WAD
            : priceOracleConfig.QuoteValue.toString(),
        ],
        verify
      );
      console.log(`Price Feed UniV2${priceBaseSymbol}AGF ${uniAGFPriceFeed.address}`);
      await mustWaitTx(priceOracle.setAssetSources([agfAddress], [uniAGFPriceFeed.address]));
    }

    await initReservePriceFeeds(addressProvider, reservesConfig, reserveAssets, underlyingMappings, verify);
  }
);
