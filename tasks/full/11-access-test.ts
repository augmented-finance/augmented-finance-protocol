import { task } from 'hardhat/config';
import { eContractid, eNetwork, tEthereumAddress } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getFirstSigner,
  getFromJsonDbByAddr,
  getInstancesFromJsonDb,
  getSignerN,
} from '../../helpers/misc-utils';
import { getLendingPoolProxy, getProtocolDataProvider } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { getContractGetterById } from '../../helpers/contract-mapper';
import { verifyMutableAccess } from '../../helpers/method-checker';
import { Contract, Signer } from 'ethers';

task('full:access-test', 'Tests access to mutable functions of the deployed contracts')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run('set-DRE');

    const user = (await getSignerN(1)) as Signer;
    console.log(user);

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    console.log('Check access to mutable methods');

    for (const [addr, entry] of getInstancesFromJsonDb()) {
      const getter = getContractGetterById(entry.id);
      if (getter == undefined) {
        console.log(`\t${entry.id} ${addr}: contract getter is unknown`);
        // throw `Unable to inspect contract: ${entry.id} ${addr}`;
        continue;
      }
      const subj = (await getter(addr)) as Contract;
      console.log(`\t${entry.id}: ${subj.address}`);
      await verifyMutableAccess(user, subj, entry.id as eContractid, true);
    }

    for (const [addr, entry] of getExternalsFromJsonDb()) {
      const implAddr = entry.verify?.impl;
      if (!implAddr) {
        continue;
      }
      const implId = getFromJsonDbByAddr(implAddr).id;

      const getter = getContractGetterById(implId);
      if (getter == undefined) {
        console.log(`\t${implId} ${addr}: proxy impl contract getter is unknown`);
        // throw `Unable to inspect proxy contract: ${entry.id} ${addr} ${implAddr}`;
        continue;
      }
      const subj = (await getter(addr)) as Contract;
      await verifyMutableAccess(user, subj, entry.id as eContractid, false);
    }

    console.log('');
  });
