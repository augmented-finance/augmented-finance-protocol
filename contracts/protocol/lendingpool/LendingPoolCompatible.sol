// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../interfaces/ILendingPoolAaveCompatible.sol';
import {LendingPool} from './LendingPool.sol';

import 'hardhat/console.sol';

/// @dev LendingPoolCompatible is a wrapper for backward compatibility with AAVE due to modified referral field format.
contract LendingPoolCompatible is LendingPool, ILendingPoolAaveCompatible {
  /// @dev AAVE compatibility method
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referral
  ) external override {
    super.deposit(asset, amount, onBehalfOf, uint256(referral));
  }

  /// @dev AAVE compatibility method
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referral,
    address onBehalfOf
  ) external override {
    asset;
    amount;
    interestRateMode;
    referral;
    onBehalfOf;
    _delegate(_extension);
  }

  /// @dev AAVE compatibility method
  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referral
  ) external override {
    receiver;
    assets;
    amounts;
    modes;
    onBehalfOf;
    params;
    referral;
    _delegate(_extension);
  }
}
