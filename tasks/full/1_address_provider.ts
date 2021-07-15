import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployLendingPoolAddressesProvider } from '../../helpers/contracts-deployments';
import { falsyOrZeroAddress, getFirstSigner, getSigner, waitForTx } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getGenesisPoolAdmin,
  getEmergencyAdmin,
} from '../../helpers/configuration';
import { eNetwork } from '../../helpers/types';
import { getAddressesProviderRegistry, getAddressById } from '../../helpers/contracts-getters';
import { formatEther, isAddress, parseEther } from 'ethers/lib/utils';
import { isZeroAddress } from 'ethereumjs-util';
import { Signer, BigNumber } from 'ethers';
import { parse } from 'path';
import { AccessFlags } from '../../helpers/access-flags';
//import BigNumber from 'bignumber.js';

task('full:deploy-address-provider', 'Deploy address provider for prod enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    let signer: Signer;
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ProviderId, MarketId } = poolConfig;

    let providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
    let providerRegistryOwner = getParamPerNetwork(poolConfig.ProviderRegistryOwner, network);

    if (falsyOrZeroAddress(providerRegistryAddress)) {
      providerRegistryAddress = await getAddressById('AddressesProviderRegistry');
      // throw Error('config.ProviderRegistry is missing or is not an address.');

      if (!falsyOrZeroAddress(providerRegistryOwner)) {
        throw Error('config.RegistryOwner is set while config.ProviderRegistry is not an address.');
      }
    }

    if (falsyOrZeroAddress(providerRegistryOwner)) {
      // throw Error('config.ProviderRegistryOwner is missing or is not an address.');
      providerRegistryOwner = (await getFirstSigner()).address;
    }

    // Checks if deployer address is registry owner
    if (process.env.MAINNET_FORK === 'true') {
      await DRE.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [providerRegistryOwner],
      });
      const firstAccount = await getFirstSigner();
      await firstAccount.sendTransaction({ value: parseEther('10'), to: providerRegistryOwner });
    }
    signer = getSigner(providerRegistryOwner);

    // 1. Address Provider Registry instance
    const addressesProviderRegistry = (
      await getAddressesProviderRegistry(providerRegistryAddress)
    ).connect(signer);

    console.log('Registry Address', addressesProviderRegistry.address);

    // 2. Deploy address provider and set genesis manager
    const addressProvider = await deployLendingPoolAddressesProvider(MarketId, verify);

    // 3. Set the provider at the Registry
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressProvider.address, ProviderId)
    );

    // 4. Set pool admins

    await waitForTx(
      await addressProvider.grantRoles(
        await getGenesisPoolAdmin(poolConfig),
        AccessFlags.POOL_ADMIN
      )
    );
    await waitForTx(
      await addressProvider.grantRoles(
        await getEmergencyAdmin(poolConfig),
        AccessFlags.EMERGENCY_ADMIN
      )
    );

    console.log('Pool Admin(s)', await addressProvider.roleActiveGrantees(AccessFlags.POOL_ADMIN));
    console.log(
      'Emergency Admin(s)',
      await addressProvider.roleActiveGrantees(AccessFlags.EMERGENCY_ADMIN)
    );
  });
