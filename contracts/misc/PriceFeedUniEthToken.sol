// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/tokens/IERC20Detailed.sol';
import '../dependencies/uniswap-v2/interfaces/IUniswapV2Pair.sol';
import '../tools/math/WadRayMath.sol';
import '../interfaces/IPriceFeed.sol';

contract PriceFeedUniEthToken is IPriceFeed {
  using WadRayMath for uint256;

  IUniswapV2Pair private _token;
  address private _underlying;
  uint112 private _decimalMul;
  uint32 private _lastUpdatedAt;
  bool private _weth1;

  constructor(address token, address weth) {
    _token = IUniswapV2Pair(token);
    (address t0, address t1) = (IUniswapV2Pair(token).token0(), IUniswapV2Pair(token).token1());
    if (t1 == weth) {
      _weth1 = true;
    } else {
      require(t0 == weth);
      t0 = t1;
    }
    _decimalMul = uint112(10)**IERC20Detailed(t0).decimals();
    _underlying = t0;

    updatePrice();
  }

  function updatePrice() public override {
    (uint256 rate, uint32 timestamp) = currentPrice();
    if (_lastUpdatedAt == timestamp) {
      return;
    }
    _lastUpdatedAt = timestamp;

    emit DerivedAssetSourceUpdated(
      _underlying,
      WadRayMath.RAY,
      address(_token),
      rate,
      timestamp,
      SourceType.UniswapV2PairToken
    );
    emit AssetPriceUpdated(_underlying, rate, timestamp);
  }

  function currentPrice() private view returns (uint256, uint32) {
    (uint112 reserve0, uint112 reserve1, uint32 timestamp) = IUniswapV2Pair(_token).getReserves();
    uint256 value;
    if (_weth1) {
      value = reserve0 > 0 ? (uint256(reserve1) * uint256(_decimalMul)) / uint256(reserve0) : 0;
    } else {
      value = reserve1 > 0 ? (uint256(reserve0) * uint256(_decimalMul)) / uint256(reserve1) : 0;
    }
    return (value, timestamp);
  }

  function latestAnswer() external view override returns (int256) {
    (uint256 rate, ) = currentPrice();
    if (rate >= uint256(type(int256).max)) {
      return type(int256).max;
    }
    return int256(rate);
  }

  function latestTimestamp() public view override returns (uint256 timestamp) {
    (, , timestamp) = IUniswapV2Pair(_token).getReserves();
  }

  function latestRound() external pure override returns (uint256) {
    // this value is checked by the OracleRouter to find out if updatePrice() should be called
    return type(uint256).max;
  }
}
