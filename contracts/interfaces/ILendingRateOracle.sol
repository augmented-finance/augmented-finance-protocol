// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

/// @dev Provides the average market borrow rate to be used as a base for the stable borrow rate calculations
interface ILendingRateOracle {
  /// @dev returns the market borrow rate in ray
  function getMarketBorrowRate(address asset) external view returns (uint256);
}
