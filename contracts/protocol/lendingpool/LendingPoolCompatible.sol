// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPoolAaveCompatible} from '../../interfaces/ILendingPoolAaveCompatible.sol';
import {LendingPool} from './LendingPool.sol';

/// @dev LendingPoolCompatible is a wrapper for backward compatibility with aave
contract LendingPoolCompatible is LendingPool, ILendingPoolAaveCompatible {
  /* AAVE compatibility method */
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referral
  ) external override {
    this.deposit(asset, amount, onBehalfOf, uint256(referral));
  }

  /* AAVE compatibility method */
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referral,
    address onBehalfOf
  ) external override {
    this.borrow(asset, amount, interestRateMode, uint256(referral), onBehalfOf);
  }

  /* AAVE compatibility method */
  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referral
  ) external override {
    this.flashLoan(receiverAddress, assets, amounts, modes, onBehalfOf, params, uint256(referral));
  }
}
