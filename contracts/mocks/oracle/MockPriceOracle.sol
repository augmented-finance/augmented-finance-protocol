// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IPriceOracle.sol';

contract MockPriceOracle is IPriceOracle {
  mapping(address => uint256) private prices;
  uint256 private ethPriceUsd;

  function getAssetPrice(address _asset) external view override returns (uint256) {
    return prices[_asset];
  }

  function getAssetsPrices(address[] calldata assets) external view override returns (uint256[] memory result) {
    result = new uint256[](assets.length);
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      result[i] = prices[assets[i]];
    }
    return result;
  }

  function setAssetPrice(address _asset, uint256 _price) external {
    prices[_asset] = _price;
    emit AssetPriceUpdated(_asset, _price, block.timestamp);
  }

  function getEthUsdPrice() external view returns (uint256) {
    return ethPriceUsd;
  }

  function setEthUsdPrice(uint256 _price) external {
    ethPriceUsd = _price;
    emit EthPriceUpdated(_price, block.timestamp);
  }

  function updateAssetSource(address asset) external override {}
}
