import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE, { ethers } from 'hardhat';
import { LibTestUtils } from '../../types';
import { mineBlocks, revertSnapshot, takeSnapshot } from '../test-augmented/utils';
import { BigNumber } from 'ethers';
import moment = require('moment');
import { RAY } from '../../helpers/constants';

chai.use(solidity);
const { expect } = chai;

describe('Library tests example', () => {
  let i: LibTestUtils;
  let blkBeforeDeploy;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    const c = await ethers.getContractFactory('LibTestUtils');
    i = await c.deploy();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it.skip('test linear interest', async () => {
    {
      let oneDayAgo = moment().subtract(1, 'days').unix();
      let res = await i.callStatic.TestLinearInterest(RAY, BigNumber.from(oneDayAgo));
      console.log(`linear rate: ${res}`);
      await mineBlocks(1);
      expect(res).eq(BigNumber.from('1002739186960933536276002029'));
    }
  });
});
