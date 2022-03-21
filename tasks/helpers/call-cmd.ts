import { subtask, types } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAddressesProviderRegistry,
  getIManagedRewardPool,
  getIRevision,
  getMarketAddressController,
  getOracleRouter,
  getPermitFreezerRewardPool,
  getProtocolDataProvider,
  getRewardBooster,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
} from '../../helpers/contracts-getters';
import {
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getFromJsonDb,
  getInstanceFromJsonDb,
  getNetworkName,
} from '../../helpers/misc-utils';
import { getContractGetterById } from '../../helpers/contracts-mapper';
import { Contract, ContractTransaction } from '@ethersproject/contracts';
import { MarketAccessController } from '../../types';
import { eContractid, eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { isHexPrefixed } from 'ethjs-util';
import { parseUnits } from '@ethersproject/units';
import { stringifyArgs } from '../../helpers/contract-verification';
import { promiseAllBatch } from './utils';

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
  .addOptionalParam('gasprice', 'Gas price', undefined, types.int)
  .addOptionalParam('nonce', 'Nonce', undefined, types.int)
  .addParam('cmds', 'Commands', [], types.any)
  .setAction(async ({ ctl, mode, cmds, gaslimit: gasLimit, gasprice: gasPrice, nonce }, DRE) => {
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

    const network = getNetworkName(DRE);
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

    const overrides = { gasLimit, gasPrice, nonce };

    if (mode == 'static' || (allStatic && allFlags == 0)) {
      if (contractCalls.length == 1 && allFlags == 0) {
        const cc = contractCalls[0];
        console.log(`Calling as static`, cc.contract.address);
        const result = await cc.contract.callStatic[cc.fnName](...cc.args);
        console.log(`Result: `, stringifyArgs(result));
      } else {
        console.log(`Calling as static batch (${contractCalls.length})`, ac.address);
        const encodedResult = await ac.callStatic.callWithRoles(prepareCallWithRolesArgs(), overrides);
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
      tx = await cc.contract.functions[cc.fnName](...cc.args, overrides);
    } else {
      console.log(`Calling as batch`, ac.address);
      tx = await ac.callWithRoles(prepareCallWithRolesArgs(), overrides);
    }

    console.log('Tx hash:', tx.hash);
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

    addNamedRewardPools: async () => {
      await call(
        qualifiedName(eContractid.RewardConfiguratorImpl, AccessFlags.REWARD_CONFIGURATOR, 'addNamedRewardPools'),
        [['0x709fBDaBe8876438696d592bf448609E633bfF97'], ['AirdropPool'], [0]],
        AccessFlags.REWARD_CONFIG_ADMIN
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
      await callContract(ac, [AccessFlags.REWARD_CONFIG_ADMIN], pool, 'setMeltDownAt', [timestamp], callParams);
    },

    setMintRate: async () =>
      await call(
        qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'updateBaseline'),
        [prepareMintRate(args[0])],
        AccessFlags.REWARD_RATE_ADMIN
      ),

    // setMintRateAndShares: async () =>
    //   await call(
    //     qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'setBaselinePercentagesAndRate'),
    //     [...(await preparePoolNamesAndShares(ac, args.slice(1))), prepareMintRate(args[0])],
    //     AccessFlags.REWARD_RATE_ADMIN
    //   ),

    setMintRateAndShares: async () => {
      const mintRate = prepareMintRate(args[0]);

      const [pools, values] = await preparePoolNamesAndShares(ac, args.slice(1));
      const updPools: string[] = [];
      const updValues: number[] = [];

      await promiseAllBatch(
        pools.map(async (pool, index) => {
          const p = await getIManagedRewardPool(pool);
          const pct = await p.getBaselinePercentage();
          if (pct == values[index]) {
            console.log('\tSkip, same rate for:', args[1 + index * 2]);
          } else {
            updPools.push(pool);
            updValues.push(values[index]);
          }
        })
      );

      if (updPools.length == 0) {
        console.log('Nothing to update');
        return;
      }

      await call(
        qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'setBaselinePercentagesAndRate'),
        [updPools, updValues, mintRate],
        AccessFlags.REWARD_RATE_ADMIN
      );
    },

    setBoostFactors: async () => {
      const [pools, values] = await preparePoolNamesAndFactors(ac, args);
      const rc = await getRewardBooster(await ac.getAddress(AccessFlags.REWARD_CONTROLLER));

      await promiseAllBatch(
        pools.map(async (pool, index) => {
          const f = await rc.callStatic.getBoostFactor(pool);
          if (f == values[index]) {
            console.log('\tSkip, same factor for:', args[index * 2]);
          } else {
            await callContract(
              ac,
              [AccessFlags.REWARD_RATE_ADMIN],
              rc,
              'setBoostFactor',
              [pool, values[index]],
              callParams
            );
          }
        })
      );
    },

    registerRefCode: async () => {
      const [codes, owners] = splitArray(2, args);
      await call(
        qualifiedName(eContractid.ReferralRewardPoolV1Impl, AccessFlags.REFERRAL_REGISTRY, 'registerShortCodes'),
        [codes, owners],
        AccessFlags.REFERRAL_ADMIN
      );
    },

    transferFromTreasury: async () =>
      await call(
        qualifiedName(eContractid.TreasuryImpl, AccessFlags.TREASURY, 'transferToken'),
        [(await findPriceTokens(ac, [args[0]]))[0], args[2], args[1]],
        AccessFlags.TREASURY_ADMIN
      ),

    setClaimablePools: async () =>
      await call(
        qualifiedName(eContractid.RewardBoosterImpl, AccessFlags.REWARD_CONTROLLER, 'setClaimablePoolsFor'),
        [args.slice(1), args[0]],
        AccessFlags.REWARD_CONFIG_ADMIN
      ),

    upgradeRewardPool: async () =>
      await call(
        qualifiedName(eContractid.RewardConfiguratorImpl, AccessFlags.REWARD_CONFIGURATOR, 'updateRewardPool'),
        [{ pool: await getRewardPoolByName(ac, args[0]), impl: args[1] }],
        AccessFlags.REWARD_CONFIG_ADMIN
      ),

    upgradeStakeToken: async () => {
      const token = await findToken(ac, args[0]);
      const sc = await getStakeConfiguratorImpl(await ac.getAddress(AccessFlags.STAKE_CONFIGURATOR));
      const data = await sc.dataOf(token);
      const fnArgs = {
        token: token,
        stakeTokenImpl: args[1],
        stkTokenName: data.stkTokenName,
        stkTokenSymbol: data.stkTokenSymbol,
      };

      await callContract(ac, [AccessFlags.STAKE_ADMIN], sc, 'updateStakeToken', [fnArgs], callParams);
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

let tokenList: undefined | any[] = undefined;
const _getTokenList = async (ac: MarketAccessController) => {
  if (tokenList === undefined) {
    const dp = await getProtocolDataProvider(await ac.getAddress(AccessFlags.DATA_HELPER));
    const list = await dp.getAllTokenDescriptions(true);
    tokenList = list.tokens.slice(0, list.tokenCount.toNumber());
  }
  return tokenList!;
};

const findPriceTokens = async (ac: MarketAccessController, names: string[], warn?: boolean) => {
  const result: string[] = [];
  for (const name of names) {
    result.push(await _findPriceToken(ac, _getTokenList, name, warn === true));
  }
  return result;
};

const _findPriceToken = async (
  ac: MarketAccessController,
  tokensFn: (ac: MarketAccessController) => Promise<any[]>,
  name: string,
  warn: boolean
) => {
  name = name.toString();
  if (!name || !falsyOrZeroAddress(name)) {
    return name;
  }
  const tokens = await tokensFn(ac);
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

const findToken = async (ac: MarketAccessController, name: string) => {
  return await _findToken(ac, _getTokenList, name, false);
};

enum TokenType {
  PoolAsset,
  Deposit,
  VariableDebt,
  StableDebt,
  Stake,
  Reward,
  RewardStake,
  HiddenStake,
}

const _findToken = async (
  ac: MarketAccessController,
  tokensFn: (ac: MarketAccessController) => Promise<any[]>,
  name: string,
  useHidden: boolean
) => {
  name = name.toString();
  if (!name || !falsyOrZeroAddress(name)) {
    return name;
  }
  const tokens = await tokensFn(ac);
  const n = name.toLowerCase();
  const matched = tokens.filter(
    (value) => value.tokenSymbol.toLowerCase() == n && (useHidden || value.tokenType != 0 + TokenType.HiddenStake)
  );
  if (matched.length == 0) {
    throw new Error('Unknown token name: ' + name);
  } else if (matched.length > 1) {
    throw new Error('Ambigous token name: ' + name);
  }

  if (falsyOrZeroAddress(matched[0].token)) {
    throw new Error('Token has no address: ' + name);
  }

  return <string>matched[0].token;
};

const poolsByNames = new Map<string, tEthereumAddress>();

const getRewardPoolByName = async (ac: MarketAccessController, name: string) => {
  if (poolsByNames.size == 0) {
    const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));

    const list = await rc.list();
    await promiseAllBatch(
      list.map(async (value) => {
        if (falsyOrZeroAddress(value)) {
          return;
        }
        const pool = await getIManagedRewardPool(value);
        const name = await pool.callStatic.getPoolName();
        let key = name.toLowerCase();
        try {
          const rev = await (await getIRevision(value)).callStatic.REVISION();
          key = key + '-' + rev.toString();
        } catch (error: any) {
          if ((<string>error.message).indexOf('UNPREDICTABLE_GAS_LIMIT') < 0) {
            throw error;
          }
        }
        const found = poolsByNames.get(key);
        if (found === undefined) {
          poolsByNames.set(key, value);
          return;
        }
        console.log('WARNING! Duplicate pool name: ', name, value, found);
      })
    );
  }
  const addr = poolsByNames.get(name.toLowerCase());
  if (falsyOrZeroAddress(addr)) {
    console.log(poolsByNames);
    throw new Error('Unknown pool name: ' + name);
  }
  return addr;
};

const preparePoolNamesAndShares = async (ac: MarketAccessController, args: any[]) =>
  _preparePoolNamesAndValues(ac, args, (v: string) => {
    return preparePercentage(v, true);
  });

const preparePoolNamesAndFactors = async (ac: MarketAccessController, args: any[]) =>
  _preparePoolNamesAndValues(ac, args, (v: string) => {
    return parseInt(v) * 10000;
  });

const _preparePoolNamesAndValues = async <T>(
  ac: MarketAccessController,
  args: any[],
  valueFn: (v: any) => T
): Promise<[pools: string[], values: T[]]> => {
  const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));
  const pools: string[] = [];
  const values: T[] = [];
  for (let i = 0; i < args.length; i += 2) {
    let addr = args[i].toString();
    if (falsyOrZeroAddress(addr)) {
      addr = await getRewardPoolByName(ac, addr);
      if (falsyOrZeroAddress(addr)) {
        throw new Error('Unknown pool name: ' + args[i]);
      }
    }
    pools.push(addr);
    values.push(valueFn(args[i + 1]));
  }
  return [pools, values];
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
