// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IChainlinkAggregator.sol';
import './IPriceOracleGetter.sol';

/// @dev Interface for a price oracle.
interface IPriceFeed is IChainlinkAggregatorMin, IPriceOracleEvents {
  function updatePrice() external;
}
