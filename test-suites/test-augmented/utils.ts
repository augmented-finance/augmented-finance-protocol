import { ethers } from 'hardhat';
import BigNumber from 'bignumber.js';

export const increaseTimeAndMine = async (secondsToIncrease: number) => {
  await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await ethers.provider.send('evm_mine', []);
};

export const mineToBlock = async (to: number) => {
  const blk = await ethers.provider.getBlock('latest');
  while (blk.number < to) {
    blk.timestamp += 1;
    await ethers.provider.send('evm_mine', [blk.timestamp]);
    blk.number += 1;
  }
  console.log(`moved to block: ${await ethers.provider.getBlock('latest')}`);
};

export const mineBlocks = async (to: number) => {
  for (let i = 0; i < to; i++) {
    const res = await ethers.provider.getBlock('latest');
    await ethers.provider.send('evm_mine', [res.timestamp + 1]);
  }
  console.log(`moved to block: ${await ethers.provider.getBlock('latest')}`);
};

export const currentBlock = async () => {
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`current block: ${currentBlock}`);
  return currentBlock;
};
