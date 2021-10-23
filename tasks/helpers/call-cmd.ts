import { subtask, types } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAddressesProviderRegistry,
  getIManagedRewardPool,
  getMarketAddressController,
  getOracleRouter,
  getPermitFreezerRewardPool,
  getProtocolDataProvider,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import {
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getFromJsonDb,
  getInstanceFromJsonDb,
} from '../../helpers/misc-utils';
import { getContractGetterById } from '../../helpers/contracts-mapper';
import { Contract, ContractTransaction } from '@ethersproject/contracts';
import { MarketAccessController } from '../../types';
import { eContractid, eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { isHexPrefixed } from 'ethjs-util';
import { parseUnits } from '@ethersproject/units';
import { stringifyArgs } from '../../helpers/etherscan-verification';

interface ICallParams {
  applyCall: (accessFlags: number, contract: Contract, fnName: string, isStatic: boolean, args: any[]) => void;
}

export interface ICallCommand {
  roles: string[];
  cmd: string;
  args: any[];
}

subtask('helper:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('mode', 'Call mode: call, waitTx, encode, static', 'call', types.string)
  .addOptionalParam('gaslimit', 'Gas limit', undefined, types.int)
  .addParam('cmds', 'Commands', [], types.any)
  .setAction(async ({ ctl, mode, cmds, gaslimit: gasLimit }, DRE) => {
    const network = <eNetwork>DRE.network.name;

    if (falsyOrZeroAddress(ctl)) {
      throw new Error('Unknown MarketAddressController');
    }
    const ac = await getMarketAddressController(ctl);

    const contractCalls: {
      accessFlags: number;
      contract: Contract;
      fnName: string;
      isStatic: boolean;
      args: any[];
    }[] = [];

    let allFlags = 0;
    let allStatic = true;

    const callParams = <ICallParams>{
      applyCall: (accessFlags: number, contract: Contract, fnName: string, isStatic: boolean, args: any[]) => {
        console.log('Parsed', isStatic ? 'static call:' : 'call:', contract.address, fnName, args);
        allFlags |= accessFlags;
        allStatic &&= isStatic;
        contractCalls.push({ accessFlags, contract, fnName, isStatic, args });
      },
    };

    for (const cmdEntry of <ICallCommand[]>cmds) {
      await parseCommand(network, ac, callParams, cmdEntry.roles, cmdEntry.cmd, cmdEntry.args || []);
    }

    if (contractCalls.length == 0) {
      console.log('Nothing to call');
      return;
    }

    const prepareCallWithRolesArgs = () => {
      const callWithRolesArgs: {
        accessFlags: number;
        callFlag: number;
        callAddr: string;
        callData: string;
      }[] = [];
      for (const call of contractCalls) {
        callWithRolesArgs.push({
          accessFlags: call.accessFlags,
          callFlag: 0,
          callAddr: call.contract.address,
          callData: call.contract.interface.encodeFunctionData(call.fnName, call.args),
        });
      }
      return callWithRolesArgs;
    };

    if (mode == 'encode') {
      if (contractCalls.length == 1 && allFlags == 0) {
        const cc = contractCalls[0];
        const encodedCall = cc.contract.interface.encodeFunctionData(cc.fnName, cc.args);
        console.log(`\nEncoded call:\n\n{\n\tto: "${cc.contract.address}",\n\tdata: "${encodedCall}"\n}\n`);
      } else {
        const encodedCall = ac.interface.encodeFunctionData('callWithRoles', [prepareCallWithRolesArgs()]);
        console.log(`\nEncoded call with roles:\n\n{\n\tto: "${ac.address}",\n\tdata: "${encodedCall}"\n}\n`);
        if (allStatic && allFlags == 0) {
          console.log('ATTN! All encoded methods are static and require no access permissions.');
        }
      }
      return;
    }
    console.log('\nCaller', await ac.signer.getAddress());

    if (mode == 'static' || (allStatic && allFlags == 0)) {
      if (contractCalls.length == 1 && allFlags == 0) {
        const cc = contractCalls[0];
        console.log(`Calling as static`, cc.contract.address);
        const result = await cc.contract.callStatic[cc.fnName](...cc.args);
        console.log(`Result: `, stringifyArgs(result));
      } else {
        console.log(`Calling as static batch (${contractCalls.length})`, ac.address);
        const encodedResult = await ac.callStatic.callWithRoles(prepareCallWithRolesArgs(), { gasLimit });
        for (let i = 0; i < contractCalls.length; i++) {
          const cc = contractCalls[i];
          const result = cc.contract.interface.decodeFunctionResult(cc.fnName, encodedResult[i]);
          console.log(`Result of ${cc.fnName}: `, stringifyArgs(result));
        }
      }
      return;
    }

    let waitTxFlag = false;
    switch (mode) {
      case 'waitTx':
        waitTxFlag = true;
        break;
      case 'call':
        break;
      default:
        throw new Error('unknown mode:' + mode);
    }

    let tx: ContractTransaction;
    if (contractCalls.length == 1 && allFlags == 0) {
      const cc = contractCalls[0];
      console.log(`Calling`, cc.contract.address);
      tx = await cc.contract.functions[cc.fnName](...cc.args, { gasLimit });
    } else {
      console.log(`Calling as batch`, ac.address);
      tx = await ac.callWithRoles(prepareCallWithRolesArgs(), { gasLimit });
    }

    if (waitTxFlag) {
      console.log('Gas used:', (await tx.wait(1)).gasUsed.toString());
    }
  });

const parseCommand = async (
  network: eNetwork,
  ac: MarketAccessController,
  callParams: ICallParams,
  roles: any[],
  cmd: string,
  args: any[]
) => {
  const dotPos = (<string>cmd).indexOf('.');
  if (dotPos >= 0) {
    await callQualifiedFunc(network, ac, roles, cmd, args, callParams);
    return;
  }

  const call = async (cmd: string, args: any[], role?: number) => {
    console.log('Call alias:', cmd, args);
    await callQualifiedFunc(network, ac, role === undefined ? [] : [role], cmd, args, callParams);
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

    setPriceSource: async () => {
      const [tokens, sources] = splitArray(2, args);
      await call(
        qualifiedName(eContractid.OracleRouter, AccessFlags.PRICE_ORACLE, 'setAssetSources'),
        [await findPriceTokens(ac, tokens, true), sources],
        AccessFlags.ORACLE_ADMIN
      );
    },

    setStaticPrice: async () => {
      const [tokens, sources] = splitArray(2, args);
      const oracle = await getOracleRouter(await ac.getPriceOracle());
      await call(
        qualifiedName(eContractid.StaticPriceOracle, await oracle.getFallbackOracle(), 'setAssetPrice'),
        [await findPriceTokens(ac, tokens, true), sources],
        AccessFlags.ORACLE_ADMIN
      );
    },

    addRewardProvider: async () => {
      const pool = await getIManagedRewardPool(await getNamedPoolAddr(ac, args[0]));
      await callContract(
        ac,
        [AccessFlags.REWARD_CONFIG_ADMIN],
        pool,
        'addRewardProvider',
        [args[1], args[2] || ZERO_ADDRESS],
        callParams
      );
    },

    setMeltdown: async () => {
      const pool = await getPermitFreezerRewardPool(await getNamedPoolAddr(ac, args[0]));

      const dateStr = args[1];
      let timestamp: number;
      if (isHexPrefixed(dateStr)) {
        timestamp = parseInt(dateStr);
      } else {
        timestamp = Date.parse(dateStr);
        if (isNaN(timestamp)) {
          throw new Error('Invalid date: ' + dateStr);
        }
        timestamp = (timestamp / 1000) | 0;
      }

      console.log('Meltdown date:', timestamp == 0 ? 'never' : new Date(timestamp * 1000));

      // pool.setMeltDownAt(timestamp);
      await callContract(ac, [AccessFlags.REWARD_CONFIG_ADMIN], pool, 'setMeltDownAt', [timestamp], callParams);
    },

    setMintRate: async () =>
      await call(
        qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'updateBaseline'),
        [prepareMintRate(args[0])],
        AccessFlags.REWARD_RATE_ADMIN
      ),

    setMintRateAndShares: async () =>
      await call(
        qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'setBaselinePercentagesAndRate'),
        [...(await preparePoolNamesAndShares(ac, args.slice(1))), prepareMintRate(args[0])],
        AccessFlags.REWARD_RATE_ADMIN
      ),

    registerRefCode: async () => {
      const [codes, owners] = splitArray(2, args);
      await call(
        qualifiedName(eContractid.ReferralRewardPoolV1Impl, AccessFlags.REFERRAL_REGISTRY, 'registerShortCodes'),
        [codes, owners],
        AccessFlags.REFERRAL_ADMIN
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
};

const callQualifiedFunc = async (
  network: eNetwork,
  ac: MarketAccessController,
  roles: (number | string)[],
  cmd: string,
  args: any[],
  callParams: ICallParams
) => {
  const dotPos = (<string>cmd).indexOf('.');
  const objName = (<string>cmd).substring(0, dotPos);
  const funcName = (<string>cmd).substring(dotPos + 1);
  const contract = await findObject(network, ac, objName);

  await callContract(ac, roles, contract, funcName, args, callParams);
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
  args: any[],
  callParams: ICallParams
) => {
  let accessFlags: number = 0;
  console.log('roles', roles);
  roles.forEach((value) => {
    if (typeof value == 'number') {
      accessFlags |= value;
      return;
    }
    const id = AccessFlags[value];
    if (id == undefined || id == 0) {
      throw new Error('Unknown role: ' + value);
    }
    accessFlags |= id;
  });

  const fnFrag = contract.interface.getFunction(funcName);
  const isStatic = fnFrag.stateMutability === 'view' || fnFrag.stateMutability === 'pure';
  callParams.applyCall(accessFlags, contract, fnFrag.name, isStatic, args);
};

const findPriceTokens = async (ac: MarketAccessController, names: string[], warn?: boolean) => {
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
    result.push(await _findPriceToken(getTokens, name, warn === true));
  }
  return result;
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

const preparePoolNamesAndShares = async (ac: MarketAccessController, args: any[]) => {
  const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));

  const byNames = new Map<string, tEthereumAddress>();

  const pools: string[] = [];
  const shares: number[] = [];
  for (let i = 0; i < args.length; i += 2) {
    let addr = args[i].toString();
    if (falsyOrZeroAddress(addr)) {
      if (byNames.size == 0) {
        const list = await rc.list();
        await Promise.all(
          list.map(async (value) => {
            const pool = await getIManagedRewardPool(value);
            const name = await pool.getPoolName();
            const key = name.toLowerCase();
            if (byNames.has(key)) {
              console.log('WARNING! Duplicate pool name: ', name, value, byNames.get(key));
              return;
            }
            byNames.set(key, value);
          })
        );
        console.log(byNames);
      }
      addr = byNames.get(addr.toLowerCase());

      if (falsyOrZeroAddress(addr)) {
        throw new Error('Unknown pool name: ' + args[i]);
      }
    }
    pools.push(addr);
    shares.push(preparePercentage(args[i + 1], true));
  }
  return [pools, shares];
};

const preparePercentage = (value: string, strict: boolean) => {
  value = value.toString();
  const pos = value.indexOf('%');
  if (pos > 0) {
    return parseUnits(value.substring(0, pos), 2).toNumber();
  } else if (strict) {
    throw new Error('Not a percentage: ' + value);
  }
  return parseInt(value);
};

const prepareMintRate = (value: string) => {
  if (isHexPrefixed(value)) {
    return value;
  }
  return parseUnits(value, 18).toString();
};

const getNamedPoolAddr = async (ac: MarketAccessController, name: string) => {
  const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));
  const [poolAddr] = await rc.getNamedRewardPools([name]);
  if (falsyOrZeroAddress(poolAddr)) {
    throw new Error('Unknown pool name: ' + name);
  }
  return poolAddr;
};

const splitArray = (n: number, a: any[]): string[][] => {
  const result: string[][] = [];
  for (let i = n; i > 0; i--) {
    result.push([]);
  }
  a.forEach((value, index) => result[index % n].push(value));
  return result;
};
