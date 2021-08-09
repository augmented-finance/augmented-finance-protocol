// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../interfaces/ILendingPoolAaveCompatible.sol';
import './LendingPool.sol';

/// @dev LendingPoolCompatible is a wrapper for backward compatibility with AAVE due to modified referral field format.
contract LendingPoolCompatible is LendingPool, ILendingPoolAaveCompatible {
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referral
  ) external override {
    super.deposit(asset, amount, onBehalfOf, uint256(referral));
  }

  function borrow(
    address,
    uint256,
    uint256,
    uint16,
    address
  ) external override {
    _delegate(_extension);
  }

  function flashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint16
  ) external override {
    _delegate(_extension);
  }
}
