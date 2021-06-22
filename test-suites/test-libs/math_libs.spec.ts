import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';
import { MathUtils } from '../../types';
import { mineBlocks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumber } from 'ethers';
import moment = require('moment');
import { RAY, PW128 } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Library tests', () => {
  let i: MathUtils;
  let blkBeforeDeploy;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    const c = await ethers.getContractFactory('MathUtils');
    i = await c.deploy();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('log2', async () => {
    {
      expect(await i.callStatic.log_2(PW128)).eq(0);
      expect(await i.callStatic.log_2(BigNumber.from(16).mul(PW128))).eq(BigNumber.from(4).mul(PW128));
    }
  });
});
