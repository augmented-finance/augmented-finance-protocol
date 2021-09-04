import { subtask, task, types } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getMarketAddressController } from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, getFirstSigner, getFromJsonDb, waitTx } from '../../helpers/misc-utils';
import { getContractGetterById } from '../../helpers/contracts-mapper';
import { Contract } from '@ethersproject/contracts';
import { MarketAccessController } from '../../types';
import { eContractid } from '../../helpers/types';

subtask('helper:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('cmd', 'Name of command', '', types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('compatible', 'Use backward compatible mode')
  .addParam('roles', 'Roles required', [], types.any)
  .addParam('args', 'Command arguments', [], types.any)
  .setAction(async ({ ctl, cmd, static: staticCall, compatible, roles, args }, DRE) => {
    if (falsyOrZeroAddress(ctl)) {
      throw new Error('Unknown MarketAddressController');
    }
    const ac = await getMarketAddressController(ctl);

    const dotPos = (<string>cmd).indexOf('.');
    if (dotPos >= 0) {
      await callFunc(ac, staticCall, compatible, roles, cmd, args);
      return;
    }

    const call = async (cmd: string, args: any[], role: number | undefined) => {
      console.log('Call alias:', cmd, args);
      await callFunc(ac, staticCall, compatible, role === undefined ? [] : [role], cmd, args);
    };

    const callName = (typeId: eContractid, instanceId: AccessFlags, funcName: string) =>
      typeId + '@' + AccessFlags[instanceId] + '.' + funcName;

    const easyCommands: {
      [key: string]: {
        cmd: string;
        role: AccessFlags;
      };
    } = {
      setCooldownForAll: {
        cmd: callName(eContractid.StakeConfiguratorImpl, AccessFlags.STAKE_CONFIGURATOR, 'setCooldownForAll'),
        role: AccessFlags.STAKE_ADMIN,
      },
    };

    const fullCmd = easyCommands[cmd];
    if (fullCmd !== undefined) {
      await call(fullCmd.cmd, args, fullCmd.role);
      return;
    }

    switch (cmd) {
      case 'setPriceSource':
        await call(
          callName(eContractid.OracleRouter, AccessFlags.PRICE_ORACLE, 'setAssetSources'),
          [[args[0]], [args[1]]],
          AccessFlags.ORACLE_ADMIN
        );
        return;
    }
    throw new Error('Unknown command: ' + cmd);
  });

const callFunc = async (
  ac: MarketAccessController,
  staticCall: boolean,
  compatible: boolean,
  roles: (number | string)[],
  cmd: string,
  args: any[]
) => {
  const dotPos = (<string>cmd).indexOf('.');
  const objName = (<string>cmd).substring(0, dotPos);
  const funcName = (<string>cmd).substring(dotPos + 1);
  const contract = await findObject(ac, objName);

  await callContract(staticCall, compatible, ac, roles, contract, funcName, args);
};

const findObject = async (ac: MarketAccessController, objName: string): Promise<Contract> => {
  const bracketPos = objName.indexOf('@');
  if (bracketPos < 0) {
    const objEntry = getFromJsonDb(objName);
    if (objEntry === undefined) {
      throw new Error('Unknown object name: ' + objName);
    }
    const [id, fn] = getContractGetterById(objName);
    if (fn === undefined) {
      throw new Error('Unsupported type name: ' + objName);
    }
    return await fn(objEntry.address);
  }

  const typeName = objName.substring(0, bracketPos);
  let addrName = objName.substring(bracketPos + 1);

  if (addrName.substring(0, 2) !== '0x') {
    const roleId = AccessFlags[addrName];
    if (roleId === undefined) {
      throw new Error('Unknown role: ' + typeName);
    }
    addrName = await ac.getAddress(roleId);
  }

  if (falsyOrZeroAddress(addrName)) {
    throw new Error('Invalid address: ' + addrName);
  }

  const [id, fn] = getContractGetterById(typeName);
  if (fn === undefined) {
    throw new Error('Unknown type name: ' + typeName);
  }
  return await fn(addrName);
};

const callContract = async (
  useStatic: boolean,
  compatible: boolean,
  ac: MarketAccessController,
  roles: (number | string)[],
  contract: Contract,
  funcName: string,
  args: any[]
) => {
  let accessFlags: number = 0;
  roles.forEach((value) => {
    if (typeof value == 'number') {
      accessFlags |= value;
      return;
    }
    const id = AccessFlags[value];
    if (id === undefined || id === 0) {
      throw new Error('Unknown role: ' + value);
    }
    accessFlags |= id;
  });

  const fnFrag = contract.interface.getFunction(funcName);
  if (fnFrag.stateMutability === 'view' || fnFrag.stateMutability === 'pure') {
    useStatic = true;
  }

  console.log('Call', useStatic ? 'static:' : 'mutable:', contract.address, fnFrag.name, args);

  if (accessFlags == 0) {
    const result = await (useStatic ? contract.callStatic : contract.functions)[fnFrag.name](...(args || []));
    if (useStatic) {
      console.log('Result: ', result);
    }
    return;
  }

  if (compatible) {
    console.log('Grant temporary admin');
    const user = await getFirstSigner();
    await waitTx(ac.setTemporaryAdmin(user.address, 10));
    try {
      console.log('Grant roles');
      await waitTx(ac.grantRoles(user.address, accessFlags));

      const result = await (useStatic ? contract.callStatic : contract.functions)[fnFrag.name](...(args || []));
      if (useStatic) {
        console.log('Result: ', result);
      }
    } finally {
      console.log('Renounce temporary admin');
      await waitTx(ac.renounceTemporaryAdmin());
    }
    return;
  }

  const callData = contract.interface.encodeFunctionData(fnFrag.name, args || []);
  if (!useStatic) {
    await ac.callWithRoles([{ accessFlags, callFlag: 0, callAddr: contract.address, callData }]);
    return;
  }
  const result = (
    await ac.callStatic.callWithRoles([{ accessFlags, callFlag: 0, callAddr: contract.address, callData }])
  )[0];
  console.log('Result: ', contract.interface.decodeFunctionResult(fnFrag.name, result));
};
