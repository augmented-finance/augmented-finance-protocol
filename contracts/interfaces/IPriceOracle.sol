// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IPriceOracleGetter.sol';

/// @dev Interface for a price oracle.
interface IPriceOracle is IPriceOracleGetter {
  function updateAssetSource(address asset) external;
}
