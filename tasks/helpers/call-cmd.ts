import { subtask, types } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAddressesProviderRegistry,
  getIManagedRewardPool,
  getMarketAddressController,
  getOracleRouter,
  getProtocolDataProvider,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import {
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getFirstSigner,
  getFromJsonDb,
  getInstanceFromJsonDb,
  waitTx,
} from '../../helpers/misc-utils';
import { getContractGetterById } from '../../helpers/contracts-mapper';
import { Contract, ContractTransaction } from '@ethersproject/contracts';
import { MarketAccessController } from '../../types';
import { eContractid, eNetwork, ICommonConfiguration } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';

interface ICallParams {
  compatible: boolean;
  useStatic: boolean;
  encode: boolean;
  args: any[];
  waitTxFlag: boolean;
  gasLimit?: number;
}

subtask('helper:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('cmd', 'Name of command', '', types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('compatible', 'Use backward compatible mode')
  .addFlag('waitTx', 'Waif for mutable tx')
  .addFlag('encode', 'Return encoded call')
  .addParam('roles', 'Roles required', [], types.any)
  .addOptionalParam('gasLimit', 'Gas limit', undefined, types.int)
  .addParam('args', 'Command arguments', [], types.any)
  .setAction(async ({ ctl, cmd, static: staticCall, compatible, encode, waitTx, roles, args, gasLimit }, DRE) => {
    const network = <eNetwork>DRE.network.name;

    if (encode) {
      if (compatible) {
        throw 'Flag --compatible is not supported with the flag --encode';
      }
      if (staticCall) {
        console.error('Flag --static is ignored with the flag --compatible');
      }
    }

    if (falsyOrZeroAddress(ctl)) {
      throw new Error('Unknown MarketAddressController');
    }
    const ac = await getMarketAddressController(ctl);

    const makeCallParams = (args: any[]) => ({
      useStatic: staticCall,
      compatible: compatible,
      encode: encode,
      args: args || [],
      waitTxFlag: waitTx,
      gasLimit: gasLimit,
    });

    const dotPos = (<string>cmd).indexOf('.');
    if (dotPos >= 0) {
      await callQualifiedFunc(network, ac, roles, cmd, makeCallParams(args));
      return;
    }

    const call = async (cmd: string, args: any[], role?: number) => {
      console.log('Call alias:', cmd, args);
      await callQualifiedFunc(network, ac, role === undefined ? [] : [role], cmd, makeCallParams(args));
    };

    const qualifiedName = (typeId: eContractid, instanceId: AccessFlags | string, funcName: string) =>
      typeId + '@' + (typeof instanceId === 'string' ? instanceId : AccessFlags[instanceId]) + '.' + funcName;

    const cmdAliases: {
      [key: string]:
        | (() => Promise<void>)
        | {
            cmd: string;
            role?: AccessFlags;
          };
    } = {
      setCooldownForAll: {
        cmd: qualifiedName(eContractid.StakeConfiguratorImpl, AccessFlags.STAKE_CONFIGURATOR, 'setCooldownForAll'),
        role: AccessFlags.STAKE_ADMIN,
      },

      getPrice: async () =>
        await call(
          qualifiedName(
            eContractid.OracleRouter,
            AccessFlags.PRICE_ORACLE,
            args.length > 1 ? 'getAssetsPrices' : 'getAssetPrice'
          ),
          args.length > 1 ? [await findPriceTokens(ac, args)] : await findPriceTokens(ac, args)
        ),

      getPriceSource: async () =>
        await call(
          qualifiedName(
            eContractid.OracleRouter,
            AccessFlags.PRICE_ORACLE,
            args.length > 1 ? 'getAssetSources' : 'getSourceOfAsset'
          ),
          args.length > 1 ? [await findPriceTokens(ac, args)] : await findPriceTokens(ac, args)
        ),

      setPriceSource: async () =>
        await call(
          qualifiedName(eContractid.OracleRouter, AccessFlags.PRICE_ORACLE, 'setAssetSources'),
          [[await findPriceToken(ac, args[0], true)], [args[1]]],
          AccessFlags.ORACLE_ADMIN
        ),

      setStaticPrice: async () => {
        const oracle = await getOracleRouter(await ac.getPriceOracle());
        await call(
          qualifiedName(eContractid.StaticPriceOracle, await oracle.getFallbackOracle(), 'setAssetPrice'),
          [await findPriceToken(ac, args[0], true), args[1]],
          AccessFlags.ORACLE_ADMIN
        );
      },

      getPrices: async () =>
        await call(
          qualifiedName(eContractid.OracleRouter, AccessFlags.PRICE_ORACLE, 'getAssetsPrices'),
          [[...args]],
          0
        ),

      addRewardProvider: async () => {
        const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));
        const [poolAddr] = await rc.getNamedRewardPools([args[0]]);
        if (falsyOrZeroAddress(poolAddr)) {
          throw new Error('Unknown pool name: ' + args[0]);
        }

        const pool = await getIManagedRewardPool(poolAddr);
        // pool.addRewardProvider(args[1], args[2] || ZERO_ADDRESS)
        await callContract(
          ac,
          [AccessFlags.REWARD_CONFIG_ADMIN],
          pool,
          'addRewardProvider',
          makeCallParams([args[1], args[2] || ZERO_ADDRESS])
        );
      },
    };

    const fullCmd = cmdAliases[cmd];
    if (fullCmd === undefined) {
      throw new Error('Unknown command: ' + cmd);
    } else if (typeof fullCmd == 'object') {
      await call(fullCmd.cmd, args, fullCmd.role || 0);
    } else {
      await fullCmd();
    }
  });

const callQualifiedFunc = async (
  network: eNetwork,
  ac: MarketAccessController,
  roles: (number | string)[],
  cmd: string,
  callParams: ICallParams
) => {
  const dotPos = (<string>cmd).indexOf('.');
  const objName = (<string>cmd).substring(0, dotPos);
  const funcName = (<string>cmd).substring(dotPos + 1);
  const contract = await findObject(network, ac, objName);

  await callContract(ac, roles, contract, funcName, callParams);
};

const findObject = async (network: eNetwork, ac: MarketAccessController, objName: string): Promise<Contract> => {
  if (objName == 'AC' || objName == 'ACCESS_CONTROLLER') {
    return ac;
  }

  if (objName == 'REGISTRY') {
    {
      const reg = getFromJsonDb(eContractid.AddressesProviderRegistry);
      if (reg !== undefined) {
        return getAddressesProviderRegistry(reg!.address);
      }
    }

    const POOL_NAME = ConfigNames.Augmented;
    const poolConfig = loadPoolConfig(POOL_NAME);
    const { ProviderRegistry } = poolConfig as ICommonConfiguration;
    const regAddr = getParamPerNetwork(ProviderRegistry, network);
    if (falsyOrZeroAddress(regAddr)) {
      throw new Error('Registry was not found');
    }
    return getAddressesProviderRegistry(regAddr);
  }

  const bracketPos = objName.indexOf('@');
  if (bracketPos < 0) {
    const objEntry = getFromJsonDb(objName);
    if (objEntry !== undefined) {
      const [id, fn] = getContractGetterById(objName);
      if (fn === undefined) {
        throw new Error('Unsupported type name: ' + objName);
      }
      return await fn(objEntry.address);
    }

    const found = getExternalsFromJsonDb().filter((value) => {
      const [addr, desc] = value;
      return desc.id == objName && !falsyOrZeroAddress(desc.verify?.impl);
    });

    if (found.length == 0) {
      throw new Error('Unknown object name: ' + objName);
    } else if (found.length > 1) {
      throw new Error('Ambigous object name: ' + objName + ', ' + found);
    }
    const [addr, desc] = found[0];
    const inst = getInstanceFromJsonDb(desc.verify!.impl!);
    if (inst == undefined) {
      throw new Error('Unknown impl address: ' + objName);
    }

    const [id, fn] = getContractGetterById(inst.id);
    if (fn === undefined) {
      throw new Error('Unsupported type name: ' + inst.id);
    }
    return await fn(addr);
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
  ac: MarketAccessController,
  roles: (number | string)[],
  contract: Contract,
  funcName: string,
  callParams: ICallParams
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
  const useStatic = callParams.useStatic || fnFrag.stateMutability === 'view' || fnFrag.stateMutability === 'pure';

  const handleResult = async (tx: ContractTransaction) => {
    if (callParams.waitTxFlag) {
      console.log('Gas used: ', (await tx.wait(1)).gasUsed.toString());
    }
  };

  console.log('Call', useStatic ? 'static:' : 'mutable:', contract.address, fnFrag.name, callParams.args);
  const callData = contract.interface.encodeFunctionData(fnFrag.name, callParams.args);

  if (accessFlags == 0) {
    if (callParams.encode) {
      console.log(`\nEncoded call:\n\n{\n\tto: "${contract.address}",\n\tdata: "${callData}"\n}\n`);
      return;
    }

    const result = await (useStatic ? contract.callStatic : contract.functions)[fnFrag.name](...callParams.args, {
      gasLimit: callParams.gasLimit,
    });
    if (useStatic) {
      console.log('Result: ', result);
    } else {
      await handleResult(result);
    }
    return;
  }

  if (callParams.compatible) {
    console.log('Grant temporary admin');
    const user = await getFirstSigner();
    await waitTx(ac.setTemporaryAdmin(user.address, 10));
    try {
      console.log('Grant roles');
      await waitTx(ac.grantRoles(user.address, accessFlags));

      const result = await (useStatic ? contract.callStatic : contract.functions)[fnFrag.name](...callParams.args);
      if (useStatic) {
        console.log('Result: ', result);
      } else {
        await handleResult(result);
      }
    } finally {
      console.log('Renounce temporary admin');
      await waitTx(ac.renounceTemporaryAdmin());
    }
    return;
  }

  const acArgs = [{ accessFlags, callFlag: 0, callAddr: contract.address, callData }];

  if (callParams.encode) {
    const acCallData = ac.interface.encodeFunctionData('callWithRoles', [acArgs]);
    console.log(`\nEncoded call:\n\n{\n\tto: "${ac.address}",\n\tdata: "${acCallData}"\n}\n`);
    return;
  }

  if (useStatic) {
    const result = (await ac.callStatic.callWithRoles(acArgs))[0];
    console.log('Result: ', contract.interface.decodeFunctionResult(fnFrag.name, result));
  } else {
    const tx = await ac.callWithRoles(acArgs);
    await handleResult(tx);
  }
};

const findPriceTokens = async (ac: MarketAccessController, names: string[]) => {
  let tokens: undefined | any[] = undefined;
  const getTokens = async () => {
    if (tokens === undefined) {
      const dp = await getProtocolDataProvider(await ac.getAddress(AccessFlags.DATA_HELPER));
      const list = await dp.getAllTokenDescriptions(true);
      tokens = list.tokens.slice(0, list.tokenCount.toNumber());
    }
    return tokens!;
  };

  const result: string[] = [];
  for (const name of names) {
    result.push(await _findPriceToken(getTokens, name, false));
  }
  return result;
};

const findPriceToken = async (ac: MarketAccessController, name: string, warn: boolean) => {
  return await _findPriceToken(
    async () => {
      const dp = await getProtocolDataProvider(await ac.getAddress(AccessFlags.DATA_HELPER));
      const list = await dp.getAllTokenDescriptions(true);
      return list.tokens.slice(0, list.tokenCount.toNumber());
    },
    name,
    warn
  );
};

const _findPriceToken = async (tokensFn: () => Promise<any[]>, name: string, warn: boolean) => {
  name = name.toString();
  if (!name || !falsyOrZeroAddress(name)) {
    return name;
  }
  const tokens = await tokensFn();
  const n = name.toLowerCase();
  const matched = tokens.filter((value) => value.tokenSymbol.toLowerCase() == n);
  if (matched.length == 0) {
    throw new Error('Unknown token name: ' + name);
  } else if (matched.length > 1) {
    throw new Error('Ambigous token name: ' + name);
  }

  const priceKey: string = matched[0].priceToken;
  if (falsyOrZeroAddress(priceKey)) {
    throw new Error('Token has no pricing token: ' + name);
  }

  const sharedPriceList = tokens.filter((value) => value.priceToken == priceKey);
  if (warn && sharedPriceList.length > 1) {
    console.log(
      'WARNING! Same price is used for: ',
      sharedPriceList.map((value) => value.tokenSymbol)
    );
  }

  return priceKey;
};
