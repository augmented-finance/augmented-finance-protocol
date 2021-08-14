// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../contracts/interfaces/ILendingPool.sol';
import '../../contracts/protocol/lendingpool/LendingPool.sol';
import {
  IMarketAccessController
} from '../../contracts/access/interfaces/IMarketAccessController.sol';
import '../../contracts/protocol/libraries/types/DataTypes.sol';

/*
Certora: Harness that delegates calls to the original LendingPool.
Used for the verification of the VariableDebtToken contract.
*/
contract LendingPoolHarnessForVariableDebtToken is ILendingPool {
  LendingPool private originalPool;

  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint64 referralCode
  ) external override {
    originalPool.deposit(asset, amount, onBehalfOf, referralCode);
  }

  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external override returns (uint256) {
    return originalPool.withdraw(asset, amount, to);
  }

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint64 referralCode,
    address onBehalfOf
  ) external override {
    originalPool.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);
  }

  function repay(
    address asset,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external override returns (uint256) {
    return originalPool.repay(asset, amount, rateMode, onBehalfOf);
  }

  function swapBorrowRateMode(address asset, uint256 rateMode) external override {
    originalPool.swapBorrowRateMode(asset, rateMode);
  }

  function rebalanceStableBorrowRate(address asset, address user) external override {
    originalPool.rebalanceStableBorrowRate(asset, user);
  }

  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external override {
    originalPool.setUserUseReserveAsCollateral(asset, useAsCollateral);
  }

  function liquidationCall(
    address collateral,
    address asset,
    address user,
    uint256 debtToCover,
    bool receiveDeposit
  ) external override {
    originalPool.liquidationCall(collateral, asset, user, debtToCover, receiveDeposit);
  }

  function getReservesList() external view override returns (address[] memory) {
    return originalPool.getReservesList();
  }

  function getReserveData(address asset)
    external
    view
    override
    returns (DataTypes.ReserveData memory)
  {
    return originalPool.getReserveData(asset);
  }

  function getUserConfiguration(address user)
    external
    view
    override
    returns (DataTypes.UserConfigurationMap memory)
  {
    return originalPool.getUserConfiguration(user);
  }

  function getUserAccountData(address user)
    external
    view
    override
    returns (
      uint256 totalCollateralETH,
      uint256 totalDebtETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    )
  {
    return originalPool.getUserAccountData(user);
  }

  function initReserve(
    address asset,
    address depositTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external override {
    originalPool.initReserve(
      asset,
      depositTokenAddress,
      stableDebtAddress,
      variableDebtAddress,
      interestRateStrategyAddress
    );
  }

  function setReserveStrategy(address asset, address strategy)
    external
    override
  {
    originalPool.setReserveStrategy(asset, strategy);
  }

  function setConfiguration(address asset, uint256 configuration) external override {
    originalPool.setConfiguration(asset, configuration);
  }

  function getConfiguration(address asset)
    external
    view
    override
    returns (DataTypes.ReserveConfigurationMap memory)
  {
    return originalPool.getConfiguration(asset);
  }

  mapping(uint256 => uint256) private reserveNormalizedIncome;

  function getReserveNormalizedIncome(address) external view override returns (uint256) {
    require(reserveNormalizedIncome[block.timestamp] == 1e27);
    return reserveNormalizedIncome[block.timestamp];
  }

  mapping(uint256 => uint256) private reserveNormalizedVariableDebt;

  function getReserveNormalizedVariableDebt(address)
    external
    view
    override
    returns (uint256)
  {
    require(reserveNormalizedVariableDebt[block.timestamp] == 1e27);
    return reserveNormalizedVariableDebt[block.timestamp];
  }

  function setPaused(bool val) external override {
    originalPool.setPaused(val);
  }

  function isPaused() external view override returns (bool) {
    return originalPool.isPaused();
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint64 referralCode
  ) external override {
    originalPool.flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referralCode);
  }

  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromAfter,
    uint256 balanceToBefore
  ) external override {
    originalPool.finalizeTransfer(asset, from, to, amount, balanceFromAfter, balanceToBefore);
  }

  function getAddressesProvider() external view override returns (IMarketAccessController) {
    return originalPool.getAddressesProvider();
  }

  function getAccessController() external view override returns (IMarketAccessController) {
    return originalPool.getAccessController();
  }
}
