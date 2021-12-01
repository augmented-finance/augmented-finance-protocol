// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/tokens/IERC20Detailed.sol';
import '../dependencies/uniswap-v2/interfaces/IUniswapV2Pair.sol';
import '../tools/math/WadRayMath.sol';
import '../interfaces/IPriceFeed.sol';

contract PriceFeedUniEthToken is IPriceFeed {
  using WadRayMath for uint256;

  IUniswapV2Pair private immutable _token;
  address private immutable _underlying;
  uint256 private immutable _quoteValue;
  uint32 private _lastUpdatedAt;
  uint8 private immutable _decimals0;
  uint8 private immutable _decimals1;
  bool private immutable _baseAt1;

  constructor(
    address token,
    address priceBase,
    uint256 quoteValue
  ) {
    require(quoteValue != 0);

    _token = IUniswapV2Pair(token);
    (address t0, address t1) = (IUniswapV2Pair(token).token0(), IUniswapV2Pair(token).token1());
    bool base1 = t1 == priceBase;
    (uint8 decimalsT0, uint8 decimalsT1) = (IERC20Detailed(t0).decimals(), IERC20Detailed(t1).decimals());
    (_decimals0, _decimals1) = base1 ? (decimalsT0, decimalsT1) : (decimalsT1, decimalsT0);

    if (!base1) {
      require(t0 == priceBase);
      t0 = t1;
    }

    _quoteValue = quoteValue;
    _underlying = t0;
    _baseAt1 = base1;
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
    uint256 value = _baseAt1 ? _calculateRate(reserve0, reserve1) : _calculateRate(reserve1, reserve0);

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

  /**
   * @dev Calculate `reserve` price expressed in `priceBase`
   */
  function _calculateRate(uint256 reserve, uint256 priceBase) private view returns (uint256) {
    return reserve > 0 ? ((priceBase * _quoteValue * 10**_decimals1) / 10**_decimals0) / reserve : 0;
  }
}
