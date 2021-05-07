import rawBRE, { ethers } from 'hardhat';

export const mineToBlock = async (to: number): Promise<number> => {
  const blk = await ethers.provider.getBlock('latest');
  if (to < blk.number) {
    console.log(`already on block: ${blk.number}`);
    return 0;
  }
  let blockMined = 0;
  const [root, ...otherUsers] = await ethers.getSigners();
  while (blk.number < to) {
    blk.number += 1;
    const nonce = await root.getTransactionCount();
    await root.sendTransaction({
      nonce: ethers.utils.hexlify(nonce),
      to: otherUsers[3].address,
      value: 1,
      chainId: rawBRE.network.config.chainId,
    });
    blockMined += 1;
  }
  const blkAfter = await ethers.provider.getBlock('latest');
  console.log(`moved to block: ${blkAfter.number}`);
  return blockMined;
};

export const currentBlock = async () => await ethers.provider.getBlockNumber();

export const takeSnapshot = async () => {
  const snap = await ethers.provider.send('evm_snapshot', []);
  console.log(`snapshot stored: ${snap}`);
  return snap;
};

export const revertSnapshot = async (id: string) => {
  const blk = await ethers.provider.send('evm_revert', [id]);
  if (!blk) {
    throw Error('failed to restore snapshot');
  }
  console.log(`snapshot restored: ${id}`);
  // TODO: after mixing evm_mine and real calls block_number is wrong, why?
  // console.log(`current block after restore: ${await currentBlock()}`);
};
