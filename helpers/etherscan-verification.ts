import { DRE, sleep } from './misc-utils';
import BigNumber from 'bignumber.js';
import { Libraries } from '@nomiclabs/hardhat-etherscan/src/solc/libraries';
import axios, { AxiosRequestConfig } from 'axios';
import qs from 'qs';

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

export const verifyContractStringified = async (address: string, constructorArguments: string, libraries?: string) =>
  _verifyContract(address, JSON.parse(constructorArguments), libraries);

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

export const verifyProxy = async (proxyAddr: string, implAddr: string) => {
  try {
    await _verifyProxy(proxyAddr, implAddr);
  } catch (error) {
    return [false, error.message];
  }

  return [true, ''];
};

const _verifyProxy = async (proxyAddr: string, implAddr: string) => {
  //  console.log(`Verifying ${proxyName}...`)
  const networkName = DRE.network.name;
  const apiKey = (<any>DRE.config).etherscan.apiKey!;
  const apiSubdomain = networkName === 'mainnet' ? 'api' : `api-${networkName}`;
  const baseUrl = `https://${apiSubdomain}.etherscan.io/api?module=contract`;

  let guid: string;
  {
    const optionsVerify: AxiosRequestConfig = {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: qs.stringify({ address: proxyAddr, expectedimplementation: implAddr }),
      url: baseUrl + `&action=verifyproxycontract&apikey=${apiKey}`,
    };
    const result = await axios(optionsVerify);
    const response = new EtherscanResponse(result.data);
    if (!response.isOk()) {
      throw `Proxy verification failed. Reason: ${response.message}`;
    }
    guid = response.message;
  }

  {
    const optionsStatus: AxiosRequestConfig = {
      method: 'GET',
      url: baseUrl + `&action=checkproxyverification&guid=${guid}&apikey=${apiKey}`,
    };
    for (let i = 0; ; i++) {
      const result = await axios(optionsStatus);
      const response = new EtherscanResponse(result.data);
      if (response.isOk()) {
        console.log();
        console.log(response.message);
        return;
      }

      if (!response.isPending()) {
        throw `Proxy verification failed. Reason: ${response.message}`;
      }
      if (i >= 20) {
        throw `Proxy verification failed. Too many retries`;
      }
      await sleep(100 + i * 200);
    }
  }
};

class EtherscanResponse {
  public readonly status: number;

  public readonly message: string;

  public constructor(response: any) {
    this.status = parseInt(response.status, 10);
    this.message = response.result;
  }

  public isPending() {
    return this.message === 'Pending in queue';
  }

  public isVerificationFailure() {
    return this.message === 'Fail - Unable to verify';
  }

  public isVerificationSuccess() {
    return this.message === 'Pass - Verified';
  }

  public isBytecodeMissingInNetworkError() {
    return this.message.startsWith('Unable to locate ContractCode at');
  }

  public isOk() {
    return this.status === 1;
  }
}
