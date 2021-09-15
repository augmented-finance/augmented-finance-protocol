import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployTreasuryImpl } from '../../helpers/contracts-deployments';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';
import { AccessFlags } from '../../helpers/access-flags';
import { getProtocolDataProvider } from '../../helpers/contracts-getters';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { addFullStep } from '../helpers/full-steps';

addFullStep(6, 'Initialize lending pool', 'full:initialize-lending-pool');

task('full:initialize-lending-pool', 'Initializes lending pool and configures reserves')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names, ReserveAssets, ReserveAssetsOpt, ReservesConfig } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    if (!reserveAssets) {
      throw 'Reserve assets are undefined. Check configuration.';
    }
    const reserveAssetsOpt = getParamPerNetwork(ReserveAssetsOpt, network);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const testHelpers = await getProtocolDataProvider(await addressProvider.getAddress(AccessFlags.DATA_HELPER));

    // Treasury implementation is updated for existing installations
    let treasuryAddress = freshStart && continuation ? await addressProvider.getAddress(AccessFlags.TREASURY) : '';

    if (falsyOrZeroAddress(treasuryAddress)) {
      const treasuryImpl = await deployTreasuryImpl(verify, continuation);
      console.log('\tTreasury implementation:', treasuryImpl.address);

      treasuryAddress = await setAndGetAddressAsProxy(addressProvider, AccessFlags.TREASURY, treasuryImpl.address);
    }
    console.log('\tTreasury:', treasuryAddress);

    console.log('ReserveAssets: ', reserveAssets);
    // asset initialization is skipped for existing assets
    await initReservesByHelper(
      addressProvider,
      ReservesConfig,
      reserveAssetsOpt,
      reserveAssets,
      Names,
      // existing reserves will be skipped for existing installations
      continuation || !freshStart,
      verify
    );
    // but configuration will be always applied
    await configureReservesByHelper(addressProvider, ReservesConfig, reserveAssets, testHelpers);
  });
