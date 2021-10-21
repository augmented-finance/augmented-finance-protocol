// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './ICombinedPriceOracle.sol';

interface IManagedCombinedPriceOracle is ICombinedPriceOracle {
  function setPriceSources(address[] calldata assets, PriceSource[] calldata prices) external;

  function setStaticPrices(address[] calldata assets, uint256[] calldata prices) external;

  function getFallback() external view returns (address);

  function setFallback(address) external;
}
