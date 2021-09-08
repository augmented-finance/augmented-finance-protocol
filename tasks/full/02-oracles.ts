import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployOracleRouter,
  deployLendingRateOracle,
  deployStaticPriceOracle,
} from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap, tEthereumAddress, PoolConfiguration } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner, mustWaitTx, waitTx } from '../../helpers/misc-utils';
import { ConfigNames, loadPoolConfig, getWethAddress, getLendingRateOracles } from '../../helpers/configuration';
import {
  getAddressesProviderRegistry,
  getIChainlinkAggregator,
  getMarketAddressController,
  getOracleRouter,
  getTokenAggregatorPairs,
  hasAddressProviderRegistry,
} from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { AddressesProviderRegistry, MarketAccessController } from '../../types';

task('full:deploy-oracles', 'Deploys oracles')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      Mocks: { UsdAddress },
      ReserveAssets,
      OracleRouter,
      FallbackOracle,
      ChainlinkAggregator,
      AGF: { DefaultPriceEth: AgfDefaultPriceEth },
    } = poolConfig as ICommonConfiguration;
    const oracleRouter = getParamPerNetwork(OracleRouter, network);
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
    let poAddress = oracleRouter;
    const requiredPriceTokens = getRequiredPrices(tokensToWatch);

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
      const deployer = await getFirstSigner();
      await waitTx(addressProvider.grantRoles(deployer.address, AccessFlags.LENDING_RATE_ADMIN));

      const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

      const lendingRateOracles = getLendingRateOracles(poolConfig);
      await setInitialMarketRatesInRatesOracleByHelper(
        lendingRateOracles,
        tokensAddressesWithoutUsd,
        lendingRateOracle
      );
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
          const ethPrice = oneEther.multipliedBy(tokenPrice);
          tokenPriceList.push(ethPrice.toString());
          console.log(`\t${tokenSymbol}: ${tokenPrice} (${ethPrice} ether)`);
        }
      }

      if (fallbackOracleAddress == '') {
        console.log('Deploying StaticPriceOracle as fallback');
        const oracle = await deployStaticPriceOracle(
          [addressProvider.address, tokenAddressList, tokenPriceList],
          verify
        );
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
      const oracleRouter = await deployOracleRouter(
        [
          addressProvider.address,
          aggregatorTokens,
          aggregators,
          fallbackOracleAddress,
          await getWethAddress(poolConfig),
        ],
        verify
      );

      const [assetSymbols, requiredAssets] = unzipTokens(requiredPriceTokens);
      console.log('Prices are required for:', assetSymbols);
      if (requiredAssets.length > 0) {
        try {
          await oracleRouter.getAssetsPrices(requiredAssets);
          console.log('All prices are available');
        } catch (err) {
          console.error(err);
          throw 'some prices are missing';
        }
      }

      await mustWaitTx(addressProvider.setAddress(AccessFlags.PRICE_ORACLE, oracleRouter.address));
      poAddress = oracleRouter.address;
    }
    console.log('PriceOracle: ', poAddress);
  });

const unzipTokens = (tokens: { [tokenSymbol: string]: tEthereumAddress }) => {
  const assetSymbols: string[] = [];
  const assets: string[] = [];
  for (const [tokenSymbol, tokenAddress] of Object.entries(tokens)) {
    if (!falsyOrZeroAddress(tokenAddress)) {
      assets.push(tokenAddress);
      assetSymbols.push(tokenSymbol);
    }
  }
  return [assetSymbols, assets];
};

const findOracleForReuse = async (
  addressProvider: MarketAccessController,
  registry: AddressesProviderRegistry,
  requiredTokens: {
    [tokenSymbol: string]: tEthereumAddress;
  }
) => {
  const [assetSymbols, assets] = unzipTokens(requiredTokens);
  console.log('Prices are required for:', assetSymbols);

  const ctlAddrs = await registry.getAddressesProvidersList();
  for (let i = ctlAddrs.length - 1; i >= 0; i--) {
    const addr = ctlAddrs[ctlAddrs.length - 1];
    if (addr == addressProvider.address) {
      continue;
    }
    const ctl = await getMarketAddressController(addr);
    const poAddress = await ctl.getPriceOracle();
    if (falsyOrZeroAddress(poAddress)) {
      continue;
    }
    if (assets.length > 0) {
      const oracle = await getOracleRouter(poAddress);
      try {
        const prices = await oracle.getAssetsPrices(assets);
      } catch (err) {
        console.log('\tUnable to reuse due to missing prices:', poAddress, 'from', addr);
        continue;
      }
    }
    return poAddress;
  }

  return '';
};

const getRequiredPrices = (allAssetsAddresses: { [tokenSymbol: string]: tEthereumAddress }) => {
  const { ETH, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;
  return assetsAddressesWithoutEth;
};
