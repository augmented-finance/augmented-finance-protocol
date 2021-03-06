import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'bignumber.js';
import { MockFlashLoanReceiver } from '../../types/MockFlashLoanReceiver';
import { getIManagedLendingPool, getMockFlashLoanReceiver } from '../../helpers/contracts-getters';

const { expect } = require('chai');

makeSuite('Pausable Pool', (testEnv: TestEnv) => {
  let _mockFlashLoanReceiver = {} as MockFlashLoanReceiver;

  const {
    LP_IS_PAUSED,
    INVALID_FROM_BALANCE_AFTER_TRANSFER,
    INVALID_TO_BALANCE_AFTER_TRANSFER,
  } = ProtocolErrors;

  before(async () => {
    _mockFlashLoanReceiver = await getMockFlashLoanReceiver();
  });

  it('User 0 deposits 1000 DAI. Configurator pauses pool. Transfers to user 1 reverts. Configurator unpauses the network and next transfer succees', async () => {
    const { users, dai, aDai, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);

    // user 0 deposits 1000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await testEnv.pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    const user0Balance = await aDai.balanceOf(users[0].address);
    const user1Balance = await aDai.balanceOf(users[1].address);

    await pool.connect(users[1].signer).setPaused(true);

    // User 0 tries the transfer to User 1
    await expect(
      aDai.connect(users[0].signer).transfer(users[1].address, amountDAItoDeposit)
    ).to.revertedWith(LP_IS_PAUSED);

    const pausedFromBalance = await aDai.balanceOf(users[0].address);
    const pausedToBalance = await aDai.balanceOf(users[1].address);

    expect(pausedFromBalance).to.be.equal(
      user0Balance.toString(),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
    expect(pausedToBalance.toString()).to.be.equal(
      user1Balance.toString(),
      INVALID_FROM_BALANCE_AFTER_TRANSFER
    );

    await pool.connect(users[1].signer).setPaused(false);

    // User 0 succeeds transfer to User 1
    await aDai.connect(users[0].signer).transfer(users[1].address, amountDAItoDeposit);

    const fromBalance = await aDai.balanceOf(users[0].address);
    const toBalance = await aDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal(
      user0Balance.sub(amountDAItoDeposit),
      INVALID_FROM_BALANCE_AFTER_TRANSFER
    );
    expect(toBalance.toString()).to.be.equal(
      user1Balance.add(amountDAItoDeposit),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
  });

  it('Deposit', async () => {
    const { users, dai, aDai, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);

    // user 0 deposits 1000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(users[1].signer).setPaused(true);
    await expect(
      testEnv.pool
        .connect(users[0].signer)
        .deposit(dai.address, amountDAItoDeposit, users[0].address, '0')
    ).to.revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('Withdraw', async () => {
    const { users, dai, aDai, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);

    // user 0 deposits 1000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await testEnv.pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    await pool.connect(users[1].signer).setPaused(true);

    // user tries to burn
    await expect(
      testEnv.pool
        .connect(users[0].signer)
        .withdraw(dai.address, amountDAItoDeposit, users[0].address)
    ).to.revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('Borrow', async () => {
    const { dai, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const user = users[1];
    await pool.connect(users[1].signer).setPaused(true);

    // Try to execute liquidation
    await expect(
      testEnv.pool.connect(user.signer).borrow(dai.address, '1', '1', '0', user.address)
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('Repay', async () => {
    const { dai, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const user = users[1];
    await pool.connect(users[1].signer).setPaused(true);

    // Try to execute liquidation
    await expect(
      testEnv.pool.connect(user.signer).repay(dai.address, '1', '1', user.address)
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('Flash loan', async () => {
    const { dai, weth, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const caller = users[3];

    const flashAmount = parseEther('0.8');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await pool.connect(users[1].signer).setPaused(true);

    await expect(
      testEnv.pool
        .connect(caller.signer)
        .flashLoan(
          _mockFlashLoanReceiver.address,
          [weth.address],
          [flashAmount],
          [1],
          caller.address,
          '0x10',
          '0'
        )
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('Liquidation call', async () => {
    const { users, usdc, oracle, weth, configurator, helpersContract } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const depositor = users[3];
    const borrower = users[4];

    //mints USDC to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 3 deposits 1000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await testEnv.pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //user 4 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await testEnv.pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //user 4 borrows
    const userGlobalData = await testEnv.pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.9502)
        .toFixed(0)
    );

    await testEnv.pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Stable, '0', borrower.address);

    // Drops HF below 1
    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.2).toFixed(0)
    );

    //mints dai to the liquidator
    await usdc.mint(await convertToCurrencyDecimals(usdc.address, '1000'));
    await usdc.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt.toString())
      .multipliedBy(0.5)
      .toFixed(0);

    await pool.connect(users[1].signer).setPaused(true);

    // Do liquidation
    await expect(
      testEnv.pool.liquidationCall(
        weth.address,
        usdc.address,
        borrower.address,
        amountToLiquidate,
        true
      )
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('SwapBorrowRateMode', async () => {
    const { weth, dai, usdc, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const user = users[1];
    const amountWETHToDeposit = parseEther('10');
    const amountDAIToDeposit = parseEther('120');
    const amountToBorrow = parseUnits('65', 6);

    await weth.connect(user.signer).mint(amountWETHToDeposit);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await testEnv.pool
      .connect(user.signer)
      .deposit(weth.address, amountWETHToDeposit, user.address, '0');

    await dai.connect(user.signer).mint(amountDAIToDeposit);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await testEnv.pool
      .connect(user.signer)
      .deposit(dai.address, amountDAIToDeposit, user.address, '0');

    await testEnv.pool
      .connect(user.signer)
      .borrow(usdc.address, amountToBorrow, 2, 0, user.address);

    await pool.connect(users[1].signer).setPaused(true);

    // Try to repay
    await expect(
      testEnv.pool.connect(user.signer).swapBorrowRateMode(usdc.address, RateMode.Stable)
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('RebalanceStableBorrowRate', async () => {
    const { dai, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const user = users[1];
    await pool.connect(users[1].signer).setPaused(true);

    await expect(
      testEnv.pool.connect(user.signer).rebalanceStableBorrowRate(dai.address, user.address)
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });

  it('setUserUseReserveAsCollateral', async () => {
    const { weth, users, configurator } = testEnv;
    const pool = await getIManagedLendingPool(testEnv.pool.address);

    const user = users[1];

    const amountWETHToDeposit = parseEther('1');
    await weth.connect(user.signer).mint(amountWETHToDeposit);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await testEnv.pool
      .connect(user.signer)
      .deposit(weth.address, amountWETHToDeposit, user.address, '0');

    await pool.connect(users[1].signer).setPaused(true);

    await expect(
      testEnv.pool.connect(user.signer).setUserUseReserveAsCollateral(weth.address, false)
    ).revertedWith(LP_IS_PAUSED);

    await pool.connect(users[1].signer).setPaused(false);
  });
});
