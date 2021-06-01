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
  console.log(`moved to block: ${blkAfter.number}`);
  return blockMined;
};

export const mineToBlock = async (to: number): Promise<number> => {
  const blk = await ethers.provider.getBlock('latest');
  if (to == blk.number) {
    console.log(`exactly at block: ${blk.number}`);
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
