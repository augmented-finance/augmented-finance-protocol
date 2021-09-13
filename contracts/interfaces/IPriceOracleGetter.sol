// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IPriceOracleEvents {
  event AssetPriceUpdated(address _asset, uint256 _price, uint256 timestamp);
  event EthPriceUpdated(uint256 _price, uint256 timestamp);
}

/// @dev Interface for a price oracle.
interface IPriceOracleGetter is IPriceOracleEvents {
  /// @dev returns the asset price in ETH
  function getAssetPrice(address asset) external view returns (uint256);
}
