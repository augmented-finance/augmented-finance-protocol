import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployOracleRouter, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap } from '../../helpers/types';
import {
  waitForTx,
  notFalsyOrZeroAddress,
  getSigner,
  getTenderlyDashboardLink,
} from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWethAddress,
  getGenesisPoolAdmin,
  getLendingRateOracles,
} from '../../helpers/configuration';
import {
  getOracleRouter,
  getMarketAddressController,
  getLendingRateOracle,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { OracleRouter } from '../../types';

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
    const addressesProvider = await getMarketAddressController();
    const oracleRouterAddress = getParamPerNetwork(poolConfig.OracleRouter, network);
    const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
    const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
    const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

    const tokensToWatch: SymbolMap<string> = {
      ...reserveAssets,
      USD: UsdAddress,
    };
    const [tokens, aggregators] = getPairsTokenAggregator(tokensToWatch, chainlinkAggregators);

    let oracleRouter: OracleRouter;
    if (notFalsyOrZeroAddress(oracleRouterAddress)) {
      oracleRouter = await await getOracleRouter(oracleRouterAddress);
      const owner = await oracleRouter.owner();
      const signer = getSigner(owner);

      oracleRouter = await (await getOracleRouter(oracleRouterAddress)).connect(signer);
      await waitForTx(await oracleRouter.setAssetSources(tokens, aggregators));
    } else {
      oracleRouter = await deployOracleRouter(
        [tokens, aggregators, fallbackOracleAddress, await getWethAddress(poolConfig)],
        verify
      );
    }

    let lendingRateOracle = await deployLendingRateOracle(verify);
    const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

    lendingRateOracle = lendingRateOracle.connect(getSigner(await lendingRateOracle.owner()));
    // This must be done any time a new market is created I believe
    //if (!lendingRateOracleAddress) {
    await setInitialMarketRatesInRatesOracleByHelper(
      lendingRateOracles,
      tokensAddressesWithoutUsd,
      lendingRateOracle
    );
    //}
    console.log('ORACLES: %s and %s', oracleRouter.address, lendingRateOracle.address);
    // Register the proxy price provider on the addressesProvider
    await waitForTx(await addressesProvider.setPriceOracle(oracleRouter.address));
    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
  });
