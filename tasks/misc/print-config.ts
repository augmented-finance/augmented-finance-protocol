import { task } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  getProtocolDataProvider,
  getMarketAddressController,
  getAddressesProviderRegistry,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { DRE } from '../../helpers/misc-utils';
import { eEthereumNetwork, eNetwork, ePolygonNetwork } from '../../helpers/types';

task('print-config', 'Inits the DRE, to have access to all the plugins')
  .addParam('dataProvider', 'Address of ProtocolDataProvider')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool, dataProvider }, localBRE) => {
    await localBRE.run('set-DRE');
    const network =
      process.env.MAINNET_FORK === 'true'
        ? eEthereumNetwork.main
        : (localBRE.network.name as eNetwork);
    const poolConfig = loadPoolConfig(pool);

    const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);

    const providerRegistry = await getAddressesProviderRegistry(providerRegistryAddress);

    const providers = await providerRegistry.getAddressesProvidersList();

    const addressProvider = await getMarketAddressController(providers[0]); // Checks first provider

    console.log('Addresses Providers', providers.join(', '));
    console.log('Market Id: ', await addressProvider.getMarketId());
    console.log('LendingPool Proxy:', await addressProvider.getLendingPool());
    console.log('Lending Pool Extension', await addressProvider.getLendingPoolExtension());
    console.log(
      'Lending Pool Configurator proxy',
      await addressProvider.getLendingPoolConfigurator()
    );
    const activeGrantees = async (flag: AccessFlags) => {
      const result = await addressProvider.roleActiveGrantees(flag);
      return result.addrList.slice(0, result.count.toNumber());
    };

    console.log('Pool Admin(s):', await activeGrantees(AccessFlags.POOL_ADMIN));
    console.log('Emergency Admin(s):', await activeGrantees(AccessFlags.EMERGENCY_ADMIN));

    console.log('Price Oracle', await addressProvider.getPriceOracle());
    console.log('Lending Rate Oracle', await addressProvider.getLendingRateOracle());
    console.log('Lending Pool Data Provider', dataProvider);
    const protocolDataProvider = await getProtocolDataProvider(dataProvider);

    const fields = [
      'decimals',
      'ltv',
      'liquidationThreshold',
      'liquidationBonus',
      'reserveFactor',
      'usageAsCollateralEnabled',
      'borrowingEnabled',
      'stableBorrowRateEnabled',
      'isActive',
      'isFrozen',
    ];
    const tokensFields = ['depositToken', 'stableDebtToken', 'variableDebtToken'];
    for (const [symbol, address] of Object.entries(
      getParamPerNetwork(poolConfig.ReserveAssets, network)
    )) {
      console.log(`- ${symbol} asset config`);
      console.log(`  - reserve address: ${address}`);

      const reserveData = await protocolDataProvider.getReserveConfigurationData(address);
      const tokensAddresses = await protocolDataProvider.getReserveTokensAddresses(address);
      fields.forEach((field, index) => {
        console.log(`  - ${field}:`, reserveData[field].toString());
      });
      tokensFields.forEach((field, index) => {
        console.log(`  - ${field}:`, tokensAddresses[index]);
      });
    }
  });
