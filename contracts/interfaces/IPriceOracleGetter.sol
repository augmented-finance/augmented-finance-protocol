// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

enum SourceType {
  AggregatorOrStatic,
  UniswapV2Pair,
  UniswapV2PairToken
}

interface IPriceOracleEvents {
  event AssetPriceUpdated(address asset, uint256 price, uint256 timestamp);
  event EthPriceUpdated(uint256 price, uint256 timestamp);
  event DerivedAssetSourceUpdated(
    address indexed asset,
    uint256 index,
    address indexed underlyingSource,
    uint256 underlyingPrice,
    uint256 timestamp,
    SourceType sourceType
  );
}

/// @dev Interface for a price oracle.
interface IPriceOracleGetter is IPriceOracleEvents {
  /// @dev returns the asset price in ETH
  function getAssetPrice(address asset) external view returns (uint256);
}
