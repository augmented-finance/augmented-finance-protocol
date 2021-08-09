// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/// @dev Interface for a price oracle.
interface IPriceOracleGetter {
  /// @dev returns the asset price in ETH
  function getAssetPrice(address asset) external view returns (uint256);
}
