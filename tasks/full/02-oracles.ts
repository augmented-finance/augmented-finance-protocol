import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployOracleRouter,
  deployLendingRateOracle,
  deployStaticPriceOracle,
} from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap, tEthereumAddress } from '../../helpers/types';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { loadPoolConfig, getWethAddress, getLendingRateOracles } from '../../helpers/configuration';
import { getIChainlinkAggregator, getTokenAggregatorPairs } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { oneEther, WAD, ZERO_ADDRESS } from '../../helpers/constants';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { deployTask } from '../helpers/deploy-steps';

deployTask('full:deploy-oracles', 'Deploy oracles', __dirname).setAction(async ({ verify, pool }, DRE) => {
  await DRE.run('set-DRE');
  const network = <eNetwork>DRE.network.name;
  const poolConfig = loadPoolConfig(pool);
  const {
    Mocks: { UsdAddress },
    ReserveAssets,
    PriceOracle,
    FallbackOracle,
    ChainlinkAggregator,
    AGF: { DefaultPriceEth: AgfDefaultPriceEth },
  } = poolConfig as ICommonConfiguration;
  const priceOracle = getParamPerNetwork(PriceOracle, network);
  const fallbackOracle = getParamPerNetwork(FallbackOracle, network);
  const reserveAssets = getParamPerNetwork(ReserveAssets, network);
  const chainlinkAggregators = getParamPerNetwork(ChainlinkAggregator, network);

  const tokensToWatch: SymbolMap<string> = {
    ...reserveAssets,
    USD: UsdAddress,
  };

  // Oracles are NOT updated for existing installations
  const [freshStart, continuation, addressProvider] = await getDeployAccessController();
  const newOracles = freshStart && !continuation;

  let lroAddress = '';
  let poAddress = '';

  const [aggregatorTokens, aggregators] = getTokenAggregatorPairs(tokensToWatch, chainlinkAggregators);

  if (!newOracles) {
    lroAddress = await addressProvider.getLendingRateOracle();
    if (falsyOrZeroAddress(poAddress)) {
      poAddress = await addressProvider.getPriceOracle();
    }
  }

  if (falsyOrZeroAddress(lroAddress)) {
    console.log('Deploying LendingRateOracle');

    const lendingRateOracle = await deployLendingRateOracle([addressProvider.address], verify);
    const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

    const lendingRateOracles = getLendingRateOracles(poolConfig);
    await setInitialMarketRatesInRatesOracleByHelper(lendingRateOracles, tokensAddressesWithoutUsd, lendingRateOracle);
    await mustWaitTx(addressProvider.setAddress(AccessFlags.LENDING_RATE_ORACLE, lendingRateOracle.address));

    lroAddress = lendingRateOracle.address;
  }
  console.log('LendingRateOracle:', lroAddress);

  if (falsyOrZeroAddress(poAddress)) {
    let fallbackOracleAddress: tEthereumAddress = '';

    const tokenAddressList: string[] = [];
    const tokenPriceList: string[] = [];

    if (typeof fallbackOracle == 'string') {
      if (fallbackOracle != '') {
        fallbackOracleAddress = fallbackOracle;
      } else if (!AgfDefaultPriceEth) {
        fallbackOracleAddress = ZERO_ADDRESS;
      }
    } else {
      for (const [tokenSymbol, tokenPrice] of Object.entries(fallbackOracle)) {
        const tokenAddress = tokensToWatch[tokenSymbol];
        if (falsyOrZeroAddress(tokenAddress)) {
          continue;
        }
        tokenAddressList.push(tokenAddress);
        if (typeof tokenPrice == 'string') {
          tokenPriceList.push(tokenPrice);
          console.log(`\t${tokenSymbol}: ${tokenPrice} wei`);
        } else {
          const ethPrice = oneEther.multipliedBy(tokenPrice).toString();
          tokenPriceList.push(ethPrice);
          console.log(`\t${tokenSymbol}: ${tokenPrice} eth (${ethPrice} wei)`);
        }
      }
    }

    if (fallbackOracleAddress == '') {
      console.log('Deploying StaticPriceOracle as fallback');
      const oracle = await deployStaticPriceOracle([addressProvider.address, tokenAddressList, tokenPriceList], verify);
      fallbackOracleAddress = oracle.address;
    }
    console.log('Fallback oracle: ', fallbackOracleAddress);

    if (aggregators.length > 0) {
      let hasErrors = false;
      console.log('Checking price sources...');
      for (let i = 0; i < aggregators.length; i++) {
        const getter = await getIChainlinkAggregator(aggregators[i]);
        try {
          await getter.latestAnswer();
          console.error('\tGot price from ', getter.address, 'for', aggregatorTokens[i]);
        } catch {
          console.error('\tFailed to get price from ', getter.address, 'for', aggregatorTokens[i]);
          hasErrors = true;
        }
      }
      if (hasErrors) {
        throw 'some price sources are broken';
      }
    }

    console.log('Deploying PriceOracle');
    console.log('\tPrice aggregators for tokens: ', aggregatorTokens);
    {
      let quoteToken = '';
      let quoteValue = '';
      if (priceOracle === 'WETH') {
        quoteToken = await getWethAddress(poolConfig);
        quoteValue = WAD;
      } else {
        quoteToken = priceOracle.QuoteToken;
        if (priceOracle.QuoteValue.eq(0)) {
          throw new Error('zero quote value');
        }
        quoteValue = priceOracle.QuoteValue.toString();
      }
      if (falsyOrZeroAddress(quoteToken)) {
        throw new Error('unknonw quote token: ' + quoteToken);
      }

      const oracleRouter = await deployOracleRouter(
        [addressProvider.address, aggregatorTokens, aggregators, fallbackOracleAddress, quoteToken, quoteValue],
        verify
      );

      await mustWaitTx(addressProvider.setAddress(AccessFlags.PRICE_ORACLE, oracleRouter.address));
      poAddress = oracleRouter.address;
    }
  }
  console.log('PriceOracle: ', poAddress);
});
