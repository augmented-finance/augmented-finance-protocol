import { task } from 'hardhat/config';
import {
  deployProtocolDataProvider,
  deployTreasuryImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import { ConfigNames, getReservesTestConfig, loadPoolConfig } from '../../helpers/configuration';

import { tEthereumAddress } from '../../helpers/types';
import { filterMapBy } from '../../helpers/misc-utils';
import { configureReservesByHelper, initReservesByHelper } from '../../helpers/init-helpers';
import { getAllTokenAddresses } from '../../helpers/mock-helpers';
import { getAllMockedTokens, getMarketAddressController } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';

task('dev:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names } = poolConfig;
    const mockTokens = await getAllMockedTokens();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    const addressesProvider = await getMarketAddressController();

    const protoPoolReservesAddresses = <{ [symbol: string]: tEthereumAddress }>(
      filterMapBy(allTokenAddresses, (key: string) => !key.includes('UNI_'))
    );

    const dataHelper = await deployProtocolDataProvider(addressesProvider.address, verify);
    await addressesProvider.setAddress(AccessFlags.DATA_HELPER, dataHelper.address);

    const reservesParams = getReservesTestConfig();

    const treasuryImpl = await deployTreasuryImpl(false, false);
    await addressesProvider.setAddressAsProxy(AccessFlags.TREASURY, treasuryImpl.address);
    const treasuryAddress = await addressesProvider.getTreasury();

    await initReservesByHelper(
      addressesProvider,
      reservesParams,
      protoPoolReservesAddresses,
      Names,
      false,
      treasuryAddress,
      verify
    );
    await configureReservesByHelper(
      addressesProvider,
      reservesParams,
      protoPoolReservesAddresses,
      dataHelper
    );
  });
