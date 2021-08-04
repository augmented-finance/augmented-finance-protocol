import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployOracleRouter,
  deployLendingRateOracle,
  deployStaticPriceOracle,
} from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap, tEthereumAddress } from '../../helpers/types';
import { falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWethAddress,
  getLendingRateOracles,
} from '../../helpers/configuration';
import { getTokenAggregatorPairs } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:deploy-oracles', 'Deploy oracles for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      Mocks: { UsdAddress },
      ReserveAssets,
      FallbackOracle,
      ChainlinkAggregator,
    } = poolConfig as ICommonConfiguration;
    const fallbackOracle = getParamPerNetwork(FallbackOracle, network);
    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const chainlinkAggregators = getParamPerNetwork(ChainlinkAggregator, network);

    const tokensToWatch: SymbolMap<string> = {
      ...reserveAssets,
      USD: UsdAddress,
    };

    let fallbackOracleAddress: tEthereumAddress;

    // Oracles are NOT updated for existing installations
    const [freshStart, continuation, addressProvider] = await getDeployAccessController();
    const newOracles = freshStart && !continuation;

    {
      let lroAddress = newOracles ? '' : await addressProvider.getLendingRateOracle();

      if (falsyOrZeroAddress(lroAddress)) {
        console.log('Deploying LendingRateOracle');

        const lendingRateOracle = await deployLendingRateOracle([addressProvider.address], verify);
        const deployer = await getFirstSigner();
        await addressProvider.grantRoles(deployer.address, AccessFlags.LENDING_RATE_ADMIN);

        const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

        const lendingRateOracles = getLendingRateOracles(poolConfig);
        await setInitialMarketRatesInRatesOracleByHelper(
          lendingRateOracles,
          tokensAddressesWithoutUsd,
          lendingRateOracle
        );
        await waitForTx(
          await addressProvider.setAddress(
            AccessFlags.LENDING_RATE_ORACLE,
            lendingRateOracle.address
          )
        );

        lroAddress = lendingRateOracle.address;
      }
      console.log('LendingRateOracle:', lroAddress);
    }

    let poAddress = newOracles ? '' : await addressProvider.getPriceOracle();

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
        [
          addressProvider.address,
          tokens,
          aggregators,
          fallbackOracleAddress,
          await getWethAddress(poolConfig),
        ],
        verify
      );
      await waitForTx(
        await addressProvider.setAddress(AccessFlags.PRICE_ORACLE, oracleRouter.address)
      );

      console.log('PriceOracle: ', oracleRouter.address);
    }
  });
