import rawBRE, { ethers } from 'hardhat';

export const mineBlocks = async (amount: number): Promise<number> => {
  const blk = await ethers.provider.getBlock('latest');
  const wallets = await ethers.getSigners();
  let blockMined = 0;
  for (let i = 0; i < amount; i++) {
    blk.number += 1;
    blockMined += 1;
    if (blk.number % 2 == 0) {
      const nonce = await wallets[7].getTransactionCount();
      await wallets[7].sendTransaction({
        nonce: ethers.utils.hexlify(nonce),
        to: wallets[8].address,
        value: 1,
        chainId: rawBRE.network.config.chainId,
      });
    } else {
      const nonce = await wallets[8].getTransactionCount();
      await wallets[8].sendTransaction({
        nonce: ethers.utils.hexlify(nonce),
        to: wallets[7].address,
        value: 1,
        chainId: rawBRE.network.config.chainId,
      });
    }
  }
  const blkAfter = await ethers.provider.getBlock('latest');
  console.log(`moved to block: ${blkAfter.number} ${blkAfter.timestamp}`);
  return blockMined;
};

export const increaseTime = async (secondsToIncrease: number) =>
  await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);

export const advanceBlock = async (timestamp: number) =>
  await ethers.provider.send('evm_mine', [timestamp]);

export const mineTicks = async (amount: number): Promise<number> => {
  const blkBefore = await ethers.provider.getBlock('latest');
  console.log(`move from block: ${blkBefore.number} ${blkBefore.timestamp} +${amount}`);
  await increaseTime(amount);
  await mineBlocks(1);
  const blkAfter = await ethers.provider.getBlock('latest');
  return blkAfter.timestamp - blkBefore.timestamp;
};

export const nextTicks = async (amount: number): Promise<void> => {
  const blkBefore = await ethers.provider.getBlock('latest');
  console.log(`move from block: ${blkBefore.number} ${blkBefore.timestamp} +)${amount}`);
  await increaseTime(amount);
  return;
};

export const nextToTicks = async (amount: number): Promise<boolean> => {
  const blkBefore = await ethers.provider.getBlock('latest');
  console.log(`move from block: ${blkBefore.number} ${blkBefore.timestamp} =>)${amount}`);
  if (blkBefore.timestamp < amount) {
    await advanceBlock(amount);
    return true;
  }
  return blkBefore.timestamp == amount;
};

export const alignTicks = async (period: number): Promise<number> => {
  const ts = (await ethers.provider.getBlock('latest')).timestamp + period - 1;
  return mineToTicks(ts - (ts % period));
};

export const mineToTicks = async (amount: number): Promise<number> => {
  const blkBefore = await ethers.provider.getBlock('latest');
  console.log(`move from block: ${blkBefore.number} ${blkBefore.timestamp} =>${amount}`);
  if (blkBefore.timestamp >= amount) {
    return 0;
  }
  await advanceBlock(amount - 1);
  await mineBlocks(1);
  const blkAfter = await ethers.provider.getBlock('latest');
  const d = blkAfter.timestamp - blkBefore.timestamp;
  if (blkBefore.timestamp + amount <= blkAfter.timestamp) {
    return blkAfter.timestamp - blkBefore.timestamp;
  }

  await mineBlocks(1);
  return blkAfter.timestamp - blkBefore.timestamp + 1;
};

export const mineToBlock = async (to: number): Promise<number> => {
  const blk = await ethers.provider.getBlock('latest');
  if (to == blk.number) {
    console.log(`exactly at block: ${blk.number} ${blk.timestamp}`);
    return 0;
  }
  if (to < blk.number) {
    return 0;
  }
  let blockMined = 0;
  const wallets = await ethers.getSigners();
  while (blk.number < to) {
    blk.number += 1;
    if (blk.number % 2 == 0) {
      const nonce = await wallets[7].getTransactionCount();
      await wallets[7].sendTransaction({
        nonce: ethers.utils.hexlify(nonce),
        to: wallets[8].address,
        value: 1,
        chainId: rawBRE.network.config.chainId,
      });
    } else {
      const nonce = await wallets[8].getTransactionCount();
      await wallets[8].sendTransaction({
        nonce: ethers.utils.hexlify(nonce),
        to: wallets[7].address,
        value: 1,
        chainId: rawBRE.network.config.chainId,
      });
    }
    blockMined += 1;
  }
  const blkAfter = await ethers.provider.getBlock('latest');
  console.log(`moved to block: ${blkAfter.number} ${blkAfter.timestamp}`);
  return blockMined;
};

export const currentBlock = async () => await ethers.provider.getBlockNumber();

export const currentTick = async () => {
  const blk = await ethers.provider.getBlock('latest');
  return blk.timestamp;
};

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
