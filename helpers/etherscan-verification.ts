import { DRE } from './misc-utils';
import BigNumber from 'bignumber.js';
import { Libraries } from '@nomiclabs/hardhat-etherscan/src/solc/libraries';

export const SUPPORTED_ETHERSCAN_NETWORKS = ['main', 'ropsten', 'kovan'];

export const stringifyArgs = (args: any) =>
  JSON.stringify(args, (key, value) => {
    if (typeof value == 'number') {
      return new BigNumber(value).toFixed();
    } else if (typeof value == 'object' && value instanceof BigNumber) {
      return value.toFixed();
    } else {
      return value;
    }
  });

export const verifyContract = async (
  address: string,
  constructorArguments: (string | string[])[],
  libraries?: string
) => _verifyContract(address, constructorArguments, libraries);

export const verifyContractStringified = async (
  address: string,
  constructorArguments: string,
  libraries?: string
) => _verifyContract(address, JSON.parse(constructorArguments), libraries);

// extracted from hardhat-etherscan
interface VerificationSubtaskArgs {
  address: string;
  constructorArguments: any[];
  // Fully qualified name of the contract
  contract?: string;
  libraries?: Libraries;
}

const _verifyContract = async (
  address: string,
  constructorArguments: any[],
  libraries?: string
): Promise<[ok: boolean, err: string]> => {
  const currentNetwork = DRE.network.name;

  let params: VerificationSubtaskArgs = {
    address,
    constructorArguments,
  };
  if (libraries) {
    params.libraries = JSON.parse(libraries!);
  }

  try {
    await DRE.run('verify:verify', params);
  } catch (error) {
    return [false, error.message];
  }

  return [true, ''];
};

export const checkEtherscanVerification = () => {
  const currentNetwork = DRE.network.name;
  if (!process.env.ETHERSCAN_KEY) {
    throw 'Missing process.env.ETHERSCAN_KEY.';
  }
  if (!SUPPORTED_ETHERSCAN_NETWORKS.includes(currentNetwork)) {
    throw `Current network ${currentNetwork} not supported Etherscan. Use: ${SUPPORTED_ETHERSCAN_NETWORKS.toString()}`;
  }
};
