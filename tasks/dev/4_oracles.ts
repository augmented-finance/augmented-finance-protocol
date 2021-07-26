import { task } from 'hardhat/config';
import {
  deployMockPriceOracle,
  deployOracleRouter,
  deployLendingRateOracle,
} from '../../helpers/contracts-deployments';
import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import { ICommonConfiguration, iAssetBase, TokenContractId } from '../../helpers/types';
import { getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { getAllAggregatorsAddresses, getAllTokenAddresses } from '../../helpers/mock-helpers';
import { ConfigNames, loadPoolConfig, getWethAddress } from '../../helpers/configuration';
import {
  getAllMockedTokens,
  getMarketAddressController,
  getTokenAggregatorPairs,
} from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';

task('dev:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const {
      Mocks: { AllAssetsInitialPrices },
      ProtocolGlobalParams: { UsdAddress, MockUsdPriceInWei },
      LendingRateOracleRatesCommon,
    } = poolConfig as ICommonConfiguration;

    const defaultTokenList = {
      ...Object.fromEntries(Object.keys(TokenContractId).map((symbol) => [symbol, ''])),
      USD: UsdAddress,
    } as iAssetBase<string>;
    const mockTokens = await getAllMockedTokens();
    const mockTokensAddress = Object.keys(mockTokens).reduce<iAssetBase<string>>((prev, curr) => {
      prev[curr as keyof iAssetBase<string>] = mockTokens[curr].address;
      return prev;
    }, defaultTokenList);
    const addressProvider = await getMarketAddressController();

    const fallbackOracle = await deployMockPriceOracle(verify);
    await waitForTx(await fallbackOracle.setEthUsdPrice(MockUsdPriceInWei));
    await setInitialAssetPricesInOracle(AllAssetsInitialPrices, mockTokensAddress, fallbackOracle);

    const mockAggregators = await deployAllMockAggregators(AllAssetsInitialPrices, verify);

    const allTokenAddresses = getAllTokenAddresses(mockTokens);
    const allAggregatorsAddresses = getAllAggregatorsAddresses(mockAggregators);

    const [tokens, aggregators] = getTokenAggregatorPairs(
      allTokenAddresses,
      allAggregatorsAddresses
    );

    await deployOracleRouter(
      [
        addressProvider.address,
        tokens,
        aggregators,
        fallbackOracle.address,
        await getWethAddress(poolConfig),
      ],
      verify
    );
    await addressProvider.setPriceOracle(fallbackOracle.address);

    const lendingRateOracle = await deployLendingRateOracle([addressProvider.address], verify);

    const deployer = await getFirstSigner();
    await addressProvider.grantRoles(deployer.address, AccessFlags.LENDING_RATE_ADMIN);

    const { USD, ...tokensAddressesWithoutUsd } = allTokenAddresses;
    const allReservesAddresses = {
      ...tokensAddressesWithoutUsd,
    };
    await setInitialMarketRatesInRatesOracleByHelper(
      LendingRateOracleRatesCommon,
      allReservesAddresses,
      lendingRateOracle
    );

    await addressProvider.setLendingRateOracle(lendingRateOracle.address);
  });
