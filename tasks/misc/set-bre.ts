import { task } from 'hardhat/config';
import { DRE, setDRE } from '../../helpers/misc-utils';
import { EthereumNetworkNames } from '../../helpers/types';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { formatEther } from 'ethers/lib/utils';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    if (DRE) {
      return;
    }
    if (
      (_DRE as HardhatRuntimeEnvironment).network.name.includes('tenderly') ||
      process.env.TENDERLY === 'true'
    ) {
      console.log('- Setting up Tenderly provider');
      if (process.env.TENDERLY_FORK_ID && process.env.TENDERLY_HEAD_ID) {
        console.log('- Connecting to a Tenderly Fork');
        _DRE.tenderlyNetwork.setFork(process.env.TENDERLY_FORK_ID);
        _DRE.tenderlyNetwork.setHead(process.env.TENDERLY_HEAD_ID);
      } else {
        console.log('- Creating a new Tenderly Fork');
        await _DRE.tenderlyNetwork.initializeFork();
      }
      const provider = new _DRE.ethers.providers.Web3Provider(_DRE.tenderlyNetwork as any);
      _DRE.ethers.provider = provider;
      console.log('- Initialized Tenderly fork:');
      console.log('  - Fork: ', _DRE.tenderlyNetwork.getFork());
      console.log('  - Head: ', _DRE.tenderlyNetwork.getHead());
      console.log('  - First account:', await (await _DRE.ethers.getSigners())[0].getAddress());
      console.log(
        '  - Balance:',
        formatEther(await (await _DRE.ethers.getSigners())[0].getBalance())
      );
    }

    setDRE(_DRE);
    return _DRE;
  }
);
