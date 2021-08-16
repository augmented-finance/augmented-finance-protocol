import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployOracleRouter,
  deployLendingRateOracle,
  deployStaticPriceOracle,
} from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap, tEthereumAddress } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner, mustWaitTx, waitTx } from '../../helpers/misc-utils';
import { ConfigNames, loadPoolConfig, getWethAddress, getLendingRateOracles } from '../../helpers/configuration';
import {
  getAddressesProviderRegistry,
  getMarketAddressController,
  getTokenAggregatorPairs,
  hasAddressProviderRegistry,
} from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { AddressesProviderRegistry } from '../../types';

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

    if (!newOracles) {
      lroAddress = await addressProvider.getLendingRateOracle();
      if (falsyOrZeroAddress(poAddress)) {
        poAddress = await addressProvider.getPriceOracle();
      }
    }

    if (poAddress != 'new' && falsyOrZeroAddress(poAddress)) {
      let registry: AddressesProviderRegistry;
      if (await hasAddressProviderRegistry()) {
        registry = await getAddressesProviderRegistry();
      } else {
        const registryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
        if (falsyOrZeroAddress(registryAddress)) {
          throw 'registry address is unknown';
        }
        registry = await getAddressesProviderRegistry(registryAddress);
      }
      const [addr, ...others] = await registry.getAddressesProvidersList();

      if (others.length > 0) {
        // this is not the first provider
        const firstCtl = await getMarketAddressController(addr);

        if (falsyOrZeroAddress(poAddress)) {
          poAddress = await firstCtl.getPriceOracle();
          console.log('Reuse PriceOracle:', poAddress, 'from', addr);
          if (!falsyOrZeroAddress(poAddress)) {
            await mustWaitTx(addressProvider.setAddress(AccessFlags.PRICE_ORACLE, poAddress));
          }
        }
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

    let fallbackOracleAddress: tEthereumAddress;

    if (falsyOrZeroAddress(poAddress)) {
      if (typeof fallbackOracle == 'string') {
        if (fallbackOracle == '') {
          fallbackOracleAddress = ZERO_ADDRESS;
        } else {
          fallbackOracleAddress = fallbackOracle;
        }
      } else {
        console.log('Deploying StaticPriceOracle as fallback');
        const tokenAddressList: string[] = [];
        const tokenPriceList: string[] = [];

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
        const oracle = await deployStaticPriceOracle(
          [addressProvider.address, tokenAddressList, tokenPriceList],
          verify
        );
        fallbackOracleAddress = oracle.address;
      }
      console.log('Fallback oracle: ', fallbackOracleAddress);

      const [tokens, aggregators] = getTokenAggregatorPairs(tokensToWatch, chainlinkAggregators);

      console.log('Deploying PriceOracle');
      console.log('\tPrice aggregators for tokens: ', tokens);
      const oracleRouter = await deployOracleRouter(
        [addressProvider.address, tokens, aggregators, fallbackOracleAddress, await getWethAddress(poolConfig)],
        verify
      );
      await mustWaitTx(addressProvider.setAddress(AccessFlags.PRICE_ORACLE, oracleRouter.address));
      poAddress = oracleRouter.address;
    }
    console.log('PriceOracle: ', poAddress);
  });
