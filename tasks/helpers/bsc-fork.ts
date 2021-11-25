import { ethers } from 'ethers';
import { NETWORKS_RPC_URL } from '../../helper-hardhat-config';
import { DRE, getNetworkName, isForkNetwork, sleep } from '../../helpers/misc-utils';
import { eOtherNetwork } from '../../helpers/types';

export const workaroundForBSCFork = async () => {
  if (!isForkNetwork() || getNetworkName() != eOtherNetwork.bsc) {
    return;
  }

  const url = NETWORKS_RPC_URL[eOtherNetwork.bsc];
  const bscProvider = new ethers.providers.JsonRpcProvider(url);
  const latestBlock = (await bscProvider.getBlockNumber()) + 5;

  console.log('WARNING! Resetting HardHat to fork BSC at ', latestBlock);
  console.log('===========================================================\n');

  while (true) {
    try {
      await DRE.network.provider.send('hardhat_reset', [
        {
          forking: {
            jsonRpcUrl: url,
            blockNumber: latestBlock,
          },
        },
      ]);
      return;
    } catch (err: any) {
      // Error: Trying to initialize a provider with block 12940084 but the current block is 12940081
      const marker = 'but the current block is ';
      const pos = (<string>err.message).indexOf(marker);
      if (pos < 0) {
        throw err;
      }
      console.log('\tWaiting:', err.message);
      await sleep(1000);
    }
  }
};
