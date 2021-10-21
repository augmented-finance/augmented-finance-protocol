// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IPriceOracleGetter.sol';

/// @dev Interface for a price oracle.
interface IPriceOracle is IPriceOracleGetter {
  event AssetSourceUpdated(address indexed asset, address indexed source);
  event FallbackOracleUpdated(address indexed fallbackOracle);
  event PriceQuoteUpdated(address indexed quote);

  function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory);

  function updateAssetSource(address asset) external;
}
