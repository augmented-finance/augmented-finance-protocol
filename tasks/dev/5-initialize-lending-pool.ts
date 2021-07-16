import { task } from 'hardhat/config';
import {
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployProtocolDataProvider,
  deployWETHGateway,
  authorizeWETHGateway,
  deployTreasuryImpl,
  deployLendingPoolCollateralManagerImpl,
} from '../../helpers/contracts-deployments';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eNetwork } from '../../helpers/types';
import {
  ConfigNames,
  getReservesConfigByPool,
  getWethAddress,
  loadPoolConfig,
} from '../../helpers/configuration';

import { tEthereumAddress, LendingPools, eContractid } from '../../helpers/types';
import { waitForTx, filterMapBy, falsyOrZeroAddress } from '../../helpers/misc-utils';
import { configureReservesByHelper, initReservesByHelper } from '../../helpers/init-helpers';
import { getAllTokenAddresses } from '../../helpers/mock-helpers';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getAllMockedTokens, getMarketAddressController } from '../../helpers/contracts-getters';

task('dev:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names, WethGateway } = poolConfig;
    const mockTokens = await getAllMockedTokens();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    const addressesProvider = await getMarketAddressController();

    const protoPoolReservesAddresses = <{ [symbol: string]: tEthereumAddress }>(
      filterMapBy(allTokenAddresses, (key: string) => !key.includes('UNI_'))
    );

    const testHelpers = await deployProtocolDataProvider(addressesProvider.address, verify);

    const reservesParams = getReservesConfigByPool(LendingPools.augmented);

    const treasuryImpl = await deployTreasuryImpl();
    addressesProvider.setTreasuryImpl(treasuryImpl.address);
    const treasuryAddress = treasuryImpl.address;

    await initReservesByHelper(
      reservesParams,
      protoPoolReservesAddresses,
      Names,
      treasuryAddress,
      verify
    );
    await configureReservesByHelper(reservesParams, protoPoolReservesAddresses, testHelpers);

    await deployWalletBalancerProvider(verify);

    const lendingPoolAddress = await addressesProvider.getLendingPool();
    const gateWay = await getParamPerNetwork(WethGateway, network);

    if (gateWay !== '') {
      await authorizeWETHGateway(gateWay, lendingPoolAddress);
    }
  });
