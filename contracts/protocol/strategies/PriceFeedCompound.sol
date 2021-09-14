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
  IChainlinkAggregatorMin private _underlyingSource;

  uint256 private _lastUpdatedAt;

  constructor(ICToken token, IChainlinkAggregatorMin underlyingSource) {
    _token = token;
    _underlyingSource = underlyingSource;
    updatePrice();
  }

  function updatePrice() public override {
    if (_lastUpdatedAt == block.timestamp) {
      return;
    }
    _lastUpdatedAt = block.timestamp;

    emit DerivedAssetSourceUpdated(
      address(_token),
      rateIndex(),
      address(_underlyingSource),
      latestUnderlyingAnswer(),
      latestTimestamp()
    );
  }

  function rateIndex() public view returns (uint256) {
    return WadRayMath.RAY.wadDiv(_token.exchangeRateStored());
  }

  function latestAnswer() external view override returns (int256) {
    return int256(latestUnderlyingAnswer().wadDiv(_token.exchangeRateStored()));
  }

  function latestUnderlyingAnswer() private view returns (uint256) {
    if (_underlyingSource == IChainlinkAggregatorMin(address(0))) {
      return 1 ether;
    }
    return uint256(_underlyingSource.latestAnswer());
  }

  function latestTimestamp() public view override returns (uint256) {
    if (_underlyingSource == IChainlinkAggregatorMin(address(0))) {
      return block.timestamp;
    }
    return _underlyingSource.latestTimestamp();
  }

  function latestRound() external pure override returns (uint256) {
    // this value is checked by the OracleRouter to find out if updatePrice() should be called
    return type(uint256).max;
  }
}
