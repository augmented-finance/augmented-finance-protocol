import { Contract, Signer, utils, ethers, BigNumberish, Overrides } from 'ethers';
import { signTypedData_v4 } from 'eth-sig-util';
import { fromRpcSig, ECDSASignature } from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
import { DRE, falsyOrZeroAddress, getFromJsonDb, addContractToJsonDb, waitForTx } from './misc-utils';
import {
  tEthereumAddress,
  tStringTokenSmallUnits,
  eEthereumNetwork,
  iParamsPerNetwork,
  eNetwork,
  iParamsPerNetworkOpt,
} from './types';
import { MintableERC20 } from '../types/MintableERC20';
import { Artifact } from 'hardhat/types';
import { getIErc20Detailed } from './contracts-getters';
import { usingTenderly } from './tenderly-utils';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { TypedDataField } from '@ethersproject/abstract-signer';

export type MockTokenMap = { [symbol: string]: MintableERC20 };

export const registerContractInJsonDb = async (contractId: string, contractInstance: Contract) =>
  addContractToJsonDb(contractId, contractInstance, true);

export const getEthersSigners = async (): Promise<Signer[]> => await (<any>DRE).ethers.getSigners();

export const getEthersSignersAddresses = async (): Promise<tEthereumAddress[]> =>
  (await (<any>DRE).ethers.getSigners()).map((signer) => signer.getAddress());

export const getCurrentBlock = async () => {
  return (<any>DRE).ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(['uint256'], data).toString());

export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (await (<any>DRE).ethers.getContractFactory(contractName)).deploy(...args)) as ContractType;
  await waitForTx(contract.deployTransaction);
  await registerContractInJsonDb(contractName, contract);
  return contract;
};

export interface ContractInstanceFactory<ContractType extends Contract> {
  deploy(overrides?: Overrides): Promise<ContractType>;
  attach(address: string): ContractType;
}

// let _verifyCallback : (id: string, contract: Contract) => Promise<void> = undefined;
//
// export const setVerifyCallback = (fn: (id: string, contract: Contract) => Promise<void>) => {
//   _verifyCallback = fn;
// }

const verifyCallback = async (id: string, contract: Contract) => {
  // if (_verifyCallback != undefined) {
  //   await _verifyCallback(id, contract);
  // }
};

export const withSaveAndVerifyOnce = async <ContractType extends Contract>(
  factory: ContractInstanceFactory<ContractType>,
  id: string,
  verify: boolean,
  once: boolean
): Promise<ContractType> => {
  if (once) {
    const addr = (await getFromJsonDb(id))?.address;
    if (!falsyOrZeroAddress(addr)) {
      return factory.attach(addr);
    }
  }
  return await withSaveAndVerify(await factory.deploy(), id, [], verify);
};

export const withSaveAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: any[],
  verify?: boolean
): Promise<ContractType> => {
  await waitForTx(instance.deployTransaction);
  if (verify) {
    await verifyCallback(id, instance);
    await addContractToJsonDb(id, instance, true, args);
  } else {
    await addContractToJsonDb(id, instance, true);
  }
  await verifyOnTenderly(instance, id);
  return instance;
};

export const registerAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: any[],
  verify?: boolean
): Promise<ContractType> => {
  if (verify) {
    await verifyCallback(id, instance);
    await addContractToJsonDb(id, instance, true, args);
  } else {
    await addContractToJsonDb(id, instance, true);
  }
  await verifyOnTenderly(instance, id);
  return instance;
};

export const withVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: any[],
  verify?: boolean
): Promise<ContractType> => {
  await waitForTx(instance.deployTransaction);
  if (verify) {
    await verifyCallback(id, instance);
    addContractToJsonDb(id, instance, false, args);
  } else {
    addContractToJsonDb(id, instance, false);
  }
  await verifyOnTenderly(instance, id);
  return instance;
};

const verifyOnTenderly = async <ContractType extends Contract>(instance: ContractType, id: string) => {
  if (usingTenderly()) {
    console.log();
    console.log('Doing Tenderly contract verification of', id);
    await (DRE as any).tenderlyNetwork.verify({
      name: id,
      address: instance.address,
    });
    console.log(`Verified ${id} at Tenderly!`);
    console.log();
  }
};

export const linkBytecode = (artifact: Artifact, libraries: any) => {
  let bytecode = artifact.bytecode;

  for (const [fileName, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];

      if (addr === undefined) {
        continue;
      }

      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }

  return bytecode;
};

export const getParamPerNetwork = <T>(param: iParamsPerNetwork<T> | iParamsPerNetworkOpt<T>, network: eNetwork): T => {
  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  if (MAINNET_FORK) {
    return param[eEthereumNetwork.main]!;
  }
  return param[network]!;
};

export const convertToCurrencyDecimals = async (tokenAddress: tEthereumAddress, amount: string) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = (await token.decimals()).toString();
  return ethers.utils.parseUnits(amount, decimals);
};

export const convertToCurrencyUnits = async (tokenAddress: string, amount: string) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = new BigNumber(await token.decimals());
  const currencyUnit = new BigNumber(10).pow(decimals);
  const amountInCurrencyUnits = new BigNumber(amount).div(currencyUnit);
  return amountInCurrencyUnits.toFixed();
};

export const buildPermitParams = (
  chainId: number,
  token: tEthereumAddress,
  revision: string,
  tokenName: string,
  owner: tEthereumAddress,
  spender: tEthereumAddress,
  nonce: number,
  deadline: string,
  value: tStringTokenSmallUnits
) => ({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit' as const,
  domain: {
    name: tokenName,
    version: revision,
    chainId: chainId,
    verifyingContract: token,
  },
  message: {
    owner,
    spender,
    value,
    nonce,
    deadline,
  },
});

export const buildRewardClaimPermitParams = (
  domain: {
    name: string;
    revision: string;
    chainId: number;
    contract: tEthereumAddress;
  },
  message?: {
    provider: tEthereumAddress;
    spender: tEthereumAddress;
    value: BigNumberish;
    nonce: BigNumberish;
    deadline: number;
  }
) => ({
  types: {
    ClaimReward: [
      { name: 'provider', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'ClaimReward' as const,
  domain: {
    name: domain.name,
    version: domain.revision,
    chainId: domain.chainId,
    verifyingContract: domain.contract,
  },
  message: message,
});

export const encodeTypeHash = (typeName: string, types: Record<string, Array<TypedDataField>>) => {
  const encoder = _TypedDataEncoder.from(types);
  return keccak256(toUtf8Bytes(encoder.encodeType(typeName)));
};

export const getSignatureFromTypedData = (
  privateKey: string,
  typedData: any // TODO: should be TypedData, from eth-sig-utils, but TS doesn't accept it
): ECDSASignature => {
  const signature = signTypedData_v4(Buffer.from(privateKey.substring(2, 66), 'hex'), {
    data: typedData,
  });
  return fromRpcSig(signature);
};

export const buildLiquiditySwapParams = (
  assetToSwapToList: tEthereumAddress[],
  minAmountsToReceive: BigNumberish[],
  swapAllBalances: BigNumberish[],
  permitAmounts: BigNumberish[],
  deadlines: BigNumberish[],
  v: BigNumberish[],
  r: (string | Buffer)[],
  s: (string | Buffer)[],
  useEthPath: boolean[]
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['address[]', 'uint256[]', 'bool[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]', 'bool[]'],
    [assetToSwapToList, minAmountsToReceive, swapAllBalances, permitAmounts, deadlines, v, r, s, useEthPath]
  );
};

export const buildRepayAdapterParams = (
  collateralAsset: tEthereumAddress,
  collateralAmount: BigNumberish,
  rateMode: BigNumberish,
  permitAmount: BigNumberish,
  deadline: BigNumberish,
  v: BigNumberish,
  r: string | Buffer,
  s: string | Buffer,
  useEthPath: boolean
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32', 'bool'],
    [collateralAsset, collateralAmount, rateMode, permitAmount, deadline, v, r, s, useEthPath]
  );
};

export const buildFlashLiquidationAdapterParams = (
  collateralAsset: tEthereumAddress,
  debtAsset: tEthereumAddress,
  user: tEthereumAddress,
  debtToCover: BigNumberish,
  useEthPath: boolean
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'address', 'uint256', 'bool'],
    [collateralAsset, debtAsset, user, debtToCover, useEthPath]
  );
};
