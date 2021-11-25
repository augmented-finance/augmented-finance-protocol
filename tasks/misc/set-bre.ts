import { task } from 'hardhat/config';
import { DRE, setDRE } from '../../helpers/misc-utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { formatEther } from 'ethers/lib/utils';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(async (_, _DRE) => {
  if (DRE) {
    return;
  }
  if ((_DRE as HardhatRuntimeEnvironment).network.name.includes('tenderly') || process.env.TENDERLY === 'true') {
    console.log('- Setting up Tenderly provider');
    const tenderlyNetwork = (<any>_DRE).tenderlyNetwork;
    if (process.env.TENDERLY_FORK_ID && process.env.TENDERLY_HEAD_ID) {
      console.log('- Connecting to a Tenderly Fork');
      tenderlyNetwork.setFork(process.env.TENDERLY_FORK_ID);
      tenderlyNetwork.setHead(process.env.TENDERLY_HEAD_ID);
    } else {
      console.log('- Creating a new Tenderly Fork');
      await tenderlyNetwork.initializeFork();
    }
    const ethers = (<any>_DRE).ethers;
    const provider = new ethers.providers.Web3Provider(tenderlyNetwork as any);
    ethers.provider = provider;
    console.log('- Initialized Tenderly fork:');
    console.log('  - Fork: ', tenderlyNetwork.getFork());
    console.log('  - Head: ', tenderlyNetwork.getHead());
    console.log('  - First account:', await (await ethers.getSigners())[0].getAddress());
    console.log('  - Balance:', formatEther(await (await ethers.getSigners())[0].getBalance()));
  }

  setDRE(_DRE);
  return _DRE;
});
