import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployLendingPoolCollateralManagerImpl,
  deployTreasuryImpl,
  deployWalletBalancerProvider,
} from '../../helpers/contracts-deployments';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { falsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import { exit } from 'process';
import {
  getProtocolDataProvider,
  getMarketAddressController,
} from '../../helpers/contracts-getters';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run('set-DRE');
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        DepositTokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        ReserveAssets,
        ReservesConfig,
      } = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);

      const addressesProvider = await getMarketAddressController();

      const testHelpers = await getProtocolDataProvider();

      const admin = await addressesProvider.getPoolAdmin();
      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      console.log('|||||=======||||', reserveAssets);

      const treasuryImpl = await deployTreasuryImpl();
      addressesProvider.addImplementation('Treasury', treasuryImpl.address);
      addressesProvider.setTreasuryImpl(treasuryImpl.address);
      const treasuryAddress = treasuryImpl.address;

      await initReservesByHelper(
        ReservesConfig,
        reserveAssets,
        DepositTokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        admin,
        treasuryAddress,
        verify
      );
      await configureReservesByHelper(ReservesConfig, reserveAssets, testHelpers, admin);

      const collateralManager = await deployLendingPoolCollateralManagerImpl(verify);
      const collateralManagerAddress = collateralManager.address;
      // Seems unnecessary to register the collateral manager in the JSON db

      console.log(
        '\tSetting lending pool collateral manager implementation with address',
        collateralManagerAddress
      );
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManagerAddress)
      );

      await deployWalletBalancerProvider(verify);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
