// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/uniswap-v2/interfaces/IUniswapV2Pair.sol';
import '../tools/math/WadRayMath.sol';
import '../interfaces/IPriceFeed.sol';

contract PriceFeedUniEthPair is IPriceFeed {
  using WadRayMath for uint256;

  address private _token;
  uint32 private _lastUpdatedAt;

  constructor(address token) {
    _token = token;
    updatePrice();
  }

  function updatePrice() public override {
    (uint256 rate, uint32 timestamp) = scaleByIndex(WadRayMath.RAY);
    if (_lastUpdatedAt == timestamp) {
      return;
    }
    _lastUpdatedAt = timestamp;

    emit DerivedAssetSourceUpdated(address(_token), rate, address(0), 1 ether, timestamp);
  }

  function scaleByIndex(uint256 v) private view returns (uint256, uint32) {
    (uint112 reserve0, uint112 reserve1, uint32 timestamp) = IUniswapV2Pair(_token).getReserves();
    if (reserve1 == 0) {
      return (0, timestamp);
    }
    return ((v * reserve0) / reserve1, timestamp);
  }

  function rateIndex() public view returns (uint256 scale) {
    (scale, ) = scaleByIndex(WadRayMath.RAY);
    return scale;
  }

  function latestAnswer() external view override returns (int256) {
    (uint256 scale, ) = scaleByIndex(1 ether);
    if (scale != 0) {
      return int256(scale);
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
