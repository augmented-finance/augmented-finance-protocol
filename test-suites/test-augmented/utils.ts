import { ethers } from 'hardhat';
import BigNumber from 'bignumber.js';

export const increaseTimeAndMine = async (secondsToIncrease: number) => {
  await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await ethers.provider.send('evm_mine', []);
};

export const mineBlocks = async (to: number) => {
  for (let i = 0; i < to; i++) {
    const res = await ethers.provider.getBlock('latest');
    const currTime = new BigNumber(res.timestamp);
    await ethers.provider.send('evm_mine', [currTime.toNumber() + 1]);
  }
};

export const currentBlock = async () => {
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`current block: ${currentBlock}`);
  return currentBlock;
};
