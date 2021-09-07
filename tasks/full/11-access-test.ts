import { task } from 'hardhat/config';
import { eContractid, eNetwork, tEthereumAddress } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  getExternalsFromJsonDb,
  getFromJsonDbByAddr,
  getInstancesFromJsonDb,
  getSignerN,
} from '../../helpers/misc-utils';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { getContractGetterById } from '../../helpers/contracts-mapper';
import { verifyContractMutableAccess, verifyProxyMutableAccess } from '../../helpers/method-checker';
import { Contract, Signer } from 'ethers';

task('full:access-test', 'Tests access to mutable functions of the deployed contracts')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run('set-DRE');

    const checkAll = true;
    const user = (await getSignerN(1)) as Signer;

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
    const estimateGas = true; // !MAINNET_FORK;

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    console.log('Check access to mutable methods');

    let hasErorrs = false;
    for (const [addr, entry] of getInstancesFromJsonDb()) {
      const name = `${entry.id} ${addr}`;

      const [contractId, getter] = getContractGetterById(entry.id);
      if (getter == undefined) {
        hasErorrs = true;
        console.log(`\tError: unknown getter ${name}`);
        if (!checkAll) {
          throw `Unable to check contract - unknown getter ${name}`;
        }
        continue;
      }
      const subj = (await getter(addr)) as Contract;
      console.log(`\tChecking: ${name}`);
      await verifyContractMutableAccess(user, subj, contractId, estimateGas, checkAll);
    }

    for (const [addr, entry] of getExternalsFromJsonDb()) {
      const implAddr = entry.verify?.impl;
      if (!implAddr) {
        continue;
      }
      const implId = getFromJsonDbByAddr(implAddr).id;
      const name = `${entry.id} ${addr} => ${implId} ${implAddr}`;

      const [contractId, getter] = getContractGetterById(implId);
      if (getter == undefined) {
        console.log(`\tError: unknown getter ${name}`);
        if (!checkAll) {
          throw `Unable to check contract - unknown getter ${name}`;
        }
        continue;
      }
      const subj = (await getter(addr)) as Contract;
      console.log(`\tChecking: ${name}`);
      await verifyProxyMutableAccess(user, subj, contractId, estimateGas, checkAll);
    }

    if (hasErorrs) {
      throw 'Mutable access check has failed';
    }

    console.log('');
  });
