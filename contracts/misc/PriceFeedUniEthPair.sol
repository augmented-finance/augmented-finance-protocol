// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/uniswap-v2/interfaces/IUniswapV2Pair.sol';
import '../tools/math/WadRayMath.sol';
import '../interfaces/IPriceFeed.sol';

contract PriceFeedUniEthPair is IPriceFeed {
  using WadRayMath for uint256;

  address private immutable _token;
  bool private immutable _baseAt1;
  uint32 private _lastUpdatedAt;

  constructor(address token, address priceBase) {
    bool baseAt1;
    if (IUniswapV2Pair(token).token1() == priceBase) {
      baseAt1 = true;
    } else {
      require(IUniswapV2Pair(token).token0() == priceBase);
    }
    _token = token;
    _baseAt1 = baseAt1;
  }

  function updatePrice() public override {
    (uint256 rate, uint32 timestamp) = currentPrice();
    if (_lastUpdatedAt == timestamp) {
      return;
    }
    _lastUpdatedAt = timestamp;

    emit DerivedAssetSourceUpdated(
      address(_token),
      WadRayMath.RAY,
      address(0),
      rate,
      timestamp,
      SourceType.UniswapV2Pair
    );
    emit AssetPriceUpdated(address(_token), rate, timestamp);
  }

  function currentPrice() private view returns (uint256, uint32) {
    (uint112 reserve0, uint112 reserve1, uint32 timestamp) = IUniswapV2Pair(_token).getReserves();
    uint256 supply = IUniswapV2Pair(_token).totalSupply();
    if (supply == 0) {
      return (0, timestamp);
    }

    uint256 value;
    if (_baseAt1) {
      value = reserve0 > 0 ? uint256(reserve1) * 2 : reserve1;
    } else {
      value = reserve1 > 0 ? uint256(reserve0) * 2 : reserve0;
    }
    // UniV2 Pair is always 18 decimals
    return ((value * 10**18) / supply, timestamp);
  }

  function latestAnswer() external view override returns (int256) {
    (uint256 rate, ) = currentPrice();
    if (rate != 0) {
      return int256(rate);
    }
    return 1;
  }

  function latestTimestamp() public view override returns (uint256 timestamp) {
    (, , timestamp) = IUniswapV2Pair(_token).getReserves();
  }

  function latestRound() external pure override returns (uint256) {
    // this value is checked by the OracleRouter to find out if updatePrice() should be called
    return type(uint256).max;
  }
}
