import BigNumber from 'bignumber.js';
import BN = require('bn.js');
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { WAD, ZERO_ADDRESS } from './constants';
import { Contract, Wallet, ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { tEthereumAddress } from './types';
import { isAddress } from 'ethers/lib/utils';
import { isZeroAddress } from 'ethereumjs-util';

export const toWad = (value: string | number) => new BigNumber(value).times(WAD).toFixed();

export const bnToBigNumber = (amount: BN): BigNumber => new BigNumber(<any>amount);
export const stringToBigNumber = (amount: string): BigNumber => new BigNumber(amount);

const getDb = () => low(new FileSync('./deployed-contracts.json'));

const getUiConfig = () => low(new FileSync('./ui-config.json'));

export let DRE: HardhatRuntimeEnvironment;

export const setDRE = (_DRE: HardhatRuntimeEnvironment) => {
  DRE = _DRE;
};

export const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const createRandomAddress = () => Wallet.createRandom().address;

export const evmSnapshot = async () => await DRE.ethers.provider.send('evm_snapshot', []);

export const evmRevert = async (id: string) => DRE.ethers.provider.send('evm_revert', [id]);

export const timeLatest = async () => {
  const block = await DRE.ethers.provider.getBlock('latest');
  return new BigNumber(block.timestamp);
};

export const advanceBlock = async (timestamp: number) =>
  await DRE.ethers.provider.send('evm_mine', [timestamp]);

export const increaseTime = async (secondsToIncrease: number) => {
  await DRE.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await DRE.ethers.provider.send('evm_mine', []);
};

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await DRE.ethers.provider.getBlockNumber();
  const currentBlock = await DRE.ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183
     */
    await DRE.ethers.provider.send('evm_increaseTime', [forwardTime]);
    await DRE.ethers.provider.send('evm_mine', []);
    //Set the next blocktime back to 15 seconds
    await DRE.ethers.provider.send('evm_increaseTime', [15]);
    return;
  }
  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await DRE.ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await DRE.ethers.provider.send('evm_mine', []);
};

export const waitForTx = async (tx: ContractTransaction) => await tx.wait(1);

export const filterMapBy = (raw: { [key: string]: any }, fn: (key: string) => boolean) =>
  Object.keys(raw)
    .filter(fn)
    .reduce<{ [key: string]: any }>((obj, key) => {
      obj[key] = raw[key];
      return obj;
    }, {});

export const chunk = <T>(arr: Array<T>, chunkSize: number): Array<Array<T>> => {
  return arr.reduce(
    (prevVal: any, currVal: any, currIndx: number, array: Array<T>) =>
      !(currIndx % chunkSize)
        ? prevVal.concat([array.slice(currIndx, currIndx + chunkSize)])
        : prevVal,
    []
  );
};

export const notFalsyOrZeroAddress = (address: tEthereumAddress | null | undefined): boolean => {
  if (!address) {
    return false;
  }
  return isAddress(address) && !isZeroAddress(address);
};

export const falsyOrZeroAddress = (address: tEthereumAddress | null | undefined): boolean => {
  return !notFalsyOrZeroAddress(address);
};

export const getSigner = (address: tEthereumAddress | string | undefined) =>
  DRE.ethers.provider.getSigner(address);

export const getTenderlyDashboardLink = () => {
  return `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${
    DRE.config.tenderly.project
  }/fork/${DRE.tenderlyNetwork.getFork()}/simulation/${DRE.tenderlyNetwork.getHead()}`;
};

export const getFirstSigner = async () => (await DRE.ethers.getSigners())[0];

export const getContractFactory = async (abi: any[], bytecode: string) =>
  await DRE.ethers.getContractFactory(abi, bytecode);

interface DbNamedEntry {
  deployer: string;
  address: string;
  count: number;
}

interface DbLogEntry {
  id: string;
  deployer: string;
}

export const cleanupJsonDb = async (currentNetwork: string) => {
  const db = getDb();
  await db.set(`${currentNetwork}`, {}).write();
};

export const logContractInJsonDb = async (
  contractId: string,
  contractInstance: Contract,
  register: boolean
) => {
  const currentNetwork = DRE.network.name;
  const db = getDb();
  const deployer = contractInstance.deployTransaction.from;

  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  if (MAINNET_FORK || (currentNetwork !== 'hardhat' && !currentNetwork.includes('coverage'))) {
    console.log(`*** ${contractId} ***\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`\n******`);
    console.log();
  }

  await db
    .set(`${currentNetwork}.log.${contractInstance.address}`, {
      id: contractId,
      deployer: deployer,
    })
    .write();

  if (register) {
    const node = `${currentNetwork}.named.${contractId}`;
    const count = (await db.get(node).value())?.count || 0;
    await db
      .set(`${currentNetwork}.named.${contractId}`, {
        address: contractInstance.address,
        deployer: deployer,
        count: count + 1,
      })
      .write();
  }
};

export const logExternalContractInJsonDb = async (contractId: string, contractAddress: string) => {
  const currentNetwork = DRE.network.name;
  const db = getDb();

  const node = `${currentNetwork}.named.${contractId}`;
  const nodeValue = await db.get(node).value();

  await db
    .set(`${currentNetwork}.named.${contractId}`, {
      address: contractAddress,
      deployer: nodeValue?.deployer ? nodeValue.deployer : ZERO_ADDRESS,
      count: 1 + (nodeValue?.count || 0),
    })
    .write();
};

export const getFromJsonDb = async (id: string) =>
  await getDb().get(`${DRE.network.name}.named.${id}`).value();

export const getFromJsonDbByAddr = async (id: string) =>
  await getDb().get(`${DRE.network.name}.log.${id}`).value();

export const hasInJsonDb = async (id: string) =>
  !falsyOrZeroAddress((await getFromJsonDb(id))?.address);

export const hasExternalInJsonDb = async (id: string) =>
  falsyOrZeroAddress((await getFromJsonDbByAddr(id))?.deployer);

export const getInstanceCountFromJsonDb = () => {
  const currentNetwork = DRE.network.name;
  const db = getDb();
  return Object.entries<DbLogEntry>(db.get(`${currentNetwork}.log`).value()).length;
};

export const printContracts = (
  deployer: string
): [Map<string, tEthereumAddress>, number, number] => {
  const currentNetwork = DRE.network.name;
  const db = getDb();

  console.log('Contracts deployed at', currentNetwork, 'by', deployer);
  console.log('---------------------------------');

  const entries = Object.entries<DbNamedEntry>(db.get(`${currentNetwork}.named`).value());
  const logEntries = Object.entries<DbLogEntry>(db.get(`${currentNetwork}.log`).value());

  let multiCount = 0;
  const entryMap = new Map<string, tEthereumAddress>();
  entries.forEach(([key, value]: [string, DbNamedEntry]) => {
    if (key.startsWith('~')) {
      return;
    } else if (value.count > 1) {
      console.log(`\t${key}: N=${value.count}`);
      multiCount++;
    } else {
      console.log(`\t${key}: ${value.address}`);
      entryMap.set(key, value.address);
    }
  });

  console.log('---------------------------------');
  console.log('N# Contracts:', entryMap.size + multiCount, '/', logEntries.length);

  return [entryMap, logEntries.length, multiCount];
};

export const cleanupUiConfig = async () => {
  const db = getUiConfig();
  await db.setState(null).write();
};

export const writeUiConfig = async (
  network: string,
  addressRegistry: string,
  addressProvider: string,
  dataHelper: string
) => {
  const db = getUiConfig();
  await db
    .setState({
      network: network,
      addressRegistry: addressRegistry,
      addressProvider: addressProvider,
      dataHelper: dataHelper,
    })
    .write();
};
