import { TestEnv, makeSuite } from './helpers/make-suite';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import {
  getIAaveLendingPool,
  getILendingPoolAaveCompatible,
} from '../../helpers/contracts-getters';
import { APPROVAL_AMOUNT_LENDING_POOL } from '../../helpers/constants';
import { ethers } from 'ethers';
import { RateMode } from '../../helpers/types';

const { expect } = require('chai');

makeSuite('ABI compatibility with Aave', (testEnv: TestEnv) => {
  it('ReserveData compatibility', async () => {
    const { users, dai, aDai } = testEnv;
    const pool = await getIAaveLendingPool(testEnv.pool.address);

    const daiReserve = await pool.getReserveData(dai.address);
    expect(daiReserve.depositTokenAddress).eq(aDai.address);
  });

  it('Deposit compatibility', async () => {
    const { users, dai } = testEnv;
    const pool = await getILendingPoolAaveCompatible(testEnv.pool.address);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');
  });

  it('Borrow compatibility', async () => {
    const { users, weth, helpersContract } = testEnv;
    const pool = await getILendingPoolAaveCompatible(testEnv.pool.address);

    const userAddress = await pool.signer.getAddress();

    await weth.connect(users[1].signer).mint(await convertToCurrencyDecimals(weth.address, '1'));
    await weth.connect(users[1].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(users[1].signer)
      .deposit(weth.address, ethers.utils.parseEther('1.0'), userAddress, '0');
    await pool
      .connect(users[0].signer)
      .borrow(weth.address, ethers.utils.parseEther('0.1'), RateMode.Stable, 0, users[0].address);

    const userReserveData = await helpersContract.getUserReserveData(
      weth.address,
      users[0].address
    );

    expect(userReserveData.currentStableDebt.toString()).to.be.eq(ethers.utils.parseEther('0.1'));
  });
});
