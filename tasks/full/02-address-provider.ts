import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployMarketAccessController } from '../../helpers/contracts-deployments';
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
  });
