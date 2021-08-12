// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IManagedLendingRateOracle {
  /// @dev sets the market borrow rate. Rate value must be in ray
  function setMarketBorrowRate(address asset, uint256 rate) external;

  /// @dev sets the market borrow rates. Rate value must be in ray
  function setMarketBorrowRates(address[] calldata assets, uint256[] calldata rates) external;
}
