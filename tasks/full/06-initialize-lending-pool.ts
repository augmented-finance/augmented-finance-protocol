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
import { getProtocolDataProvider } from '../../helpers/contracts-getters';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { AccessFlags } from '../../helpers/access-flags';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names, ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

    const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
    if (!reserveAssets) {
      throw 'Reserve assets are undefined. Check configuration.';
    }

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const testHelpers = await getProtocolDataProvider(
      await addressProvider.getAddress(AccessFlags.DATA_HELPER)
    );

    let treasuryAddress = freshStart && !continuation ? '' : await addressProvider.getTreasury();
    if (falsyOrZeroAddress(treasuryAddress)) {
      const treasuryImpl = await deployTreasuryImpl();
      await addressProvider.setTreasuryImpl(treasuryImpl.address);
      console.log('\tTreasury implementation:', treasuryImpl.address);
      treasuryAddress = treasuryImpl.address;
    }
    console.log('\tTreasury:', treasuryAddress);

    console.log('ReserveAssets: ', reserveAssets);
    await initReservesByHelper(ReservesConfig, reserveAssets, Names, treasuryAddress, verify);
    await configureReservesByHelper(ReservesConfig, reserveAssets, testHelpers);

    await deployWalletBalancerProvider(verify);
  });
