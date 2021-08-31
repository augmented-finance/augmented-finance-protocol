import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';
import { LibTestUtils } from '../../types';

chai.use(solidity);
const { expect } = chai;

describe('Library tests example', () => {
  let lib: LibTestUtils;

  before(async () => {
    const c = await (<any>rawBRE).ethers.getContractFactory('LibTestUtils');
    lib = await c.deploy();
  });

  it('test bitLength', async () => {
    expect(await lib.callStatic.testBitLength(0)).eq(0);
    expect(await lib.callStatic.testBitLength(1)).eq(1);
    expect(await lib.callStatic.testBitLength(2)).eq(2);
    expect(await lib.callStatic.testBitLength(3)).eq(2);
    expect(await lib.callStatic.testBitLength(4)).eq(3);
    expect(await lib.callStatic.testBitLength(5)).eq(3);
    expect(await lib.callStatic.testBitLength(6)).eq(3);
    expect(await lib.callStatic.testBitLength(7)).eq(3);
    expect(await lib.callStatic.testBitLength(8)).eq(4);

    for (let i = 0; i < 256; i++) {
      expect(await lib.callStatic.testBitLengthShift(i)).eq(i + 1);
    }
  });
});
