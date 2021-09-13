// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/WadRayMath.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import '../../interfaces/IPoolToken.sol';
import '../../interfaces/IDerivedToken.sol';
import '../../interfaces/IChainlinkAggregator.sol';
import '../../interfaces/IPriceFeed.sol';

contract PriceFeedCompound is IChainlinkAggregatorMin, IPriceFeed {
  using WadRayMath for uint256;

  ICToken private _token;
  IChainlinkAggregatorMin private _underlyingPrice;

  struct PriceMark {
    uint224 price;
    uint32 timestamp;
  }

  PriceMark private _price;

  constructor(ICToken token, IChainlinkAggregatorMin underlyingPrice) {
    _token = token;
    _underlyingPrice = underlyingPrice;
    updatePrice();
  }

  function updatePrice() public override {
    uint224 newPrice = uint224(uint256(_underlyingPrice.latestAnswer()).wadDiv(_token.exchangeRateStored()));
    if (newPrice == 0) {
      newPrice = 1;
    }
    if (_price.price != newPrice) {
      _price = PriceMark(newPrice, uint32(block.timestamp));
      emit AssetPriceUpdated(address(_token), newPrice, uint32(block.timestamp));
    }
  }

  function latestAnswer() external view override returns (int256) {
    return int256(uint256(_price.price));
  }

  function latestTimestamp() external view override returns (uint256 ts) {
    return _price.timestamp;
  }
}
