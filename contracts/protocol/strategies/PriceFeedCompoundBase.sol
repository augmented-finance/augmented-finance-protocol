// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/WadRayMath.sol';
import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import '../../interfaces/IPriceFeed.sol';

abstract contract PriceFeedCompoundBase is IPriceFeed {
  using WadRayMath for uint256;

  ICToken private _token;
  uint224 private _rateScale;
  uint32 private _lastUpdatedAt;

  constructor(ICToken token, uint8 underlyingDecimals) {
    _token = token;
    _rateScale = uint224(10**(18 - 8 + underlyingDecimals));
  }

  function updatePrice() public override {
    if (_lastUpdatedAt == uint32(block.timestamp)) {
      return;
    }
    _lastUpdatedAt = uint32(block.timestamp);

    uint256 answer = latestUnderlyingAnswer();
    uint256 index = rateIndex();
    uint256 timestamp = latestTimestamp();
    emit DerivedAssetSourceUpdated(
      address(_token),
      index,
      address(getUnderlyingSource()),
      answer,
      timestamp,
      SourceType.AggregatorOrStatic
    );
    emit AssetPriceUpdated(address(_token), answer.rayMul(index), timestamp);
  }

  function scaleByIndex(uint256 v) private view returns (uint256) {
    return (v * _token.exchangeRateStored()) / _rateScale;
  }

  function rateIndex() public view returns (uint256) {
    return scaleByIndex(WadRayMath.RAY);
  }

  function latestAnswer() external view override returns (int256) {
    return int256(scaleByIndex(latestUnderlyingAnswer()));
  }

  function getUnderlyingSource() internal view virtual returns (address);

  function latestUnderlyingAnswer() internal view virtual returns (uint256);

  function latestTimestamp() public view virtual override returns (uint256);

  function latestRound() external pure override returns (uint256) {
    // this value is checked by the OracleRouter to find out if updatePrice() should be called
    return type(uint256).max;
  }
}
