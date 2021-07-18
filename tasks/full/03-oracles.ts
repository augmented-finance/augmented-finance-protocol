import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployOracleRouter, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap } from '../../helpers/types';
import { getFirstSigner } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWethAddress,
  getLendingRateOracles,
} from '../../helpers/configuration';
import {
  getMarketAddressController,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';

task('full:deploy-oracles', 'Deploy oracles for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      ProtocolGlobalParams: { UsdAddress },
      ReserveAssets,
      FallbackOracle,
      ChainlinkAggregator,
    } = poolConfig as ICommonConfiguration;
    const lendingRateOracles = getLendingRateOracles(poolConfig);
    const addressProvider = await getMarketAddressController();
    const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
    const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
    const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

    const tokensToWatch: SymbolMap<string> = {
      ...reserveAssets,
      USD: UsdAddress,
    };
    const [tokens, aggregators] = getPairsTokenAggregator(tokensToWatch, chainlinkAggregators);

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

    let lendingRateOracle = await deployLendingRateOracle([addressProvider.address], verify);
    const deployer = await getFirstSigner();
    await addressProvider.grantRoles(deployer.address, AccessFlags.LENDING_RATE_ADMIN);

    const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

    await setInitialMarketRatesInRatesOracleByHelper(
      lendingRateOracles,
      tokensAddressesWithoutUsd,
      lendingRateOracle
    );
    //}
    console.log('ORACLES: %s and %s', oracleRouter.address, lendingRateOracle.address);
    // Register the proxy price provider on the addressProvider
    await addressProvider.setPriceOracle(oracleRouter.address);
    await addressProvider.setLendingRateOracle(lendingRateOracle.address);
  });
