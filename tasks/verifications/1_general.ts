import { error } from 'console';
import { zeroAddress } from 'ethereumjs-util';
import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getProtocolDataProvider,
  getAddressById,
  getMarketAddressController,
  getAddressesProviderRegistry,
  getLendingPoolCollateralManagerImpl,
  getLendingPoolConfiguratorImpl,
  getLendingPoolImpl,
  getWETHGateway,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { verifyContract } from '../../helpers/etherscan-verification';
import { notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';

task('verify:general', 'Verify contracts at Etherscan')
  .addFlag('all', 'Verify all contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run('set-DRE');
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      ProviderRegistry,
      MarketId,
    } = poolConfig as ICommonConfiguration;

    const registryAddress = getParamPerNetwork(ProviderRegistry, network);
    const addressesProviderRegistry = notFalsyOrZeroAddress(registryAddress)
      ? await getAddressesProviderRegistry(registryAddress)
      : await getAddressesProviderRegistry();

    const addressesProvider = await getMarketAddressController();

    const lendingPoolAddress = await addressesProvider.getLendingPool();
    const lendingPoolConfiguratorAddress = await addressesProvider.getLendingPoolConfigurator();
    const lendingPoolCollateralManagerAddress = await addressesProvider.getLendingPoolCollateralManager();

    if (all) {
      const lendingPoolImpl = await getLendingPoolImpl();
      const lendingPoolConfiguratorImpl = await getLendingPoolConfiguratorImpl();
      const lendingPoolCollateralManagerImpl = await getLendingPoolCollateralManagerImpl();

      const dataProvider = await getProtocolDataProvider();

      const wethGateway = await getWETHGateway();

      // Address Provider
      console.log('\n- Verifying address provider...\n');
      await verifyContract(addressesProvider.address, [MarketId]);

      // Address Provider Registry
      console.log('\n- Verifying address provider registry...\n');
      await verifyContract(addressesProviderRegistry.address, []);

      // Lending Pool implementation
      console.log('\n- Verifying LendingPool Implementation...\n');
      await verifyContract(lendingPoolImpl.address, []);

      // Lending Pool Configurator implementation
      console.log('\n- Verifying LendingPool Configurator Implementation...\n');
      await verifyContract(lendingPoolConfiguratorImpl.address, []);

      // Lending Pool Collateral Manager implementation
      console.log('\n- Verifying LendingPool Collateral Manager Implementation...\n');
      await verifyContract(lendingPoolCollateralManagerImpl.address, []);

      // Test helpers
      console.log('\n- Verifying  Aave  Provider Helpers...\n');
      await verifyContract(dataProvider.address, [addressesProvider.address]);

      // // Wallet balance provider
      // console.log('\n- Verifying  Wallet Balance Provider...\n');
      // await verifyContract(walletProvider.address, []);

      // WETHGateway
      console.log('\n- Verifying  WETHGateway...\n');
      await verifyContract(wethGateway.address, [await getWethAddress(poolConfig)]);
    }
    // Lending Pool proxy
    console.log('\n- Verifying  Lending Pool Proxy...\n');
    await verifyContract(lendingPoolAddress, [addressesProvider.address]);

    // LendingPool Conf proxy
    console.log('\n- Verifying  Lending Pool Configurator Proxy...\n');
    await verifyContract(lendingPoolConfiguratorAddress, [addressesProvider.address]);

    // Proxy collateral manager
    console.log('\n- Verifying  Lending Pool Collateral Manager Proxy...\n');
    await verifyContract(lendingPoolCollateralManagerAddress, []);

    const treasuryAddress = await addressesProvider.getTreasury();

    // DelegatedAwareAToken
    console.log('\n- Verifying DelegatedAwareAToken...\n');
    const UNI = getParamPerNetwork(ReserveAssets, network).UNI;
    const aUNI = await getAddressById('aUNI');
    if (aUNI) {
      console.log('Verifying aUNI');
      await verifyContract(aUNI, [
        lendingPoolAddress,
        UNI,
        treasuryAddress,
        'Aave interest UNI',
        'aUNI',
        ZERO_ADDRESS,
      ]);
    } else {
      console.error('Missing aUNI address at JSON DB. Skipping...');
    }
    console.log('Finished verifications.');
  });
