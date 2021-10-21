// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IFallbackPriceOracle.sol';
import '../../interfaces/IPriceOracle.sol';

enum PriceSourceType {
  Chainlink,
  ChainlinkWithUpdate,
  UniV2EthPair
}

interface ICombinedPriceOracle is IPriceOracle, IFallbackPriceOracle {
  // solhint-disable-next-line func-name-mixedcase
  //  function WETH() external view returns (address);

  function getAssetPrice(address asset)
    external
    view
    override(IFallbackPriceOracle, IPriceOracleGetter)
    returns (uint256 v);

  function getAssetPrices(address[] calldata asset) external view returns (uint256[] memory);

  struct PriceSource {
    address source;
    uint224 staticPrice;
    PriceSourceType sourceType;
  }

  function getPriceSource(address asset) external view returns (PriceSource memory);

  function getPriceSources(address[] calldata asset) external view returns (PriceSource[] memory);
}
