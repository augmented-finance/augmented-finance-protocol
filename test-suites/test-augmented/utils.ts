import { ethers } from 'hardhat';

export const mineToBlock = async (to: number) => {
  const blk = await ethers.provider.getBlock('latest');
  while (blk.number < to) {
    blk.timestamp += 1;
    await ethers.provider.send('evm_mine', [blk.timestamp]);
    blk.number += 1;
  }
  console.log(`moved to block: ${blk.number}`);
};

export const mineBlocks = async (to: number) => {
  const blk = await ethers.provider.getBlock('latest');
  for (let i = 0; i < to; i++) {
    blk.timestamp += 1;
    await ethers.provider.send('evm_mine', [blk.timestamp]);
    blk.number += 1;
  }
  console.log(`moved to block: ${blk.number}`);
};

export const currentBlock = async () => {
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`current block: ${currentBlock}`);
  return currentBlock;
};

export const snapshotBlock = async () => {
  const snap = await ethers.provider.send('evm_snapshot', []);
  console.log(`snapshot stored: ${snap}`);
  return snap;
};

export const revertToSnapshotBlock = async (id: string) => {
  const blk = await ethers.provider.send('evm_revert', [id]);
  if (!blk) {
    throw Error('failed to restore snapshot');
  }
  console.log(`snapshot restored: ${id}`);
  await currentBlock();
};
