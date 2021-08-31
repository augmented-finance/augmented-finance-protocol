// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/Errors.sol';

abstract contract CalcLinearRewardAccum {
  uint256 private _rate;
  uint256 private _accumRate;
  uint256 private _consumed;
  uint32 private _rateUpdatedAt;

  function setLinearRate(uint256 rate) internal {
    setLinearRateAt(rate, getCurrentTick());
  }

  function setLinearRateAt(uint256 rate, uint32 at) internal {
    if (_rate == rate) {
      return;
    }

    uint32 prevTick = _rateUpdatedAt;
    if (at != prevTick) {
      uint256 prevRate = _rate;
      internalMarkRateUpdate(at);
      _rate = rate;
      internalRateUpdated(prevRate, prevTick, at);
    }
  }

  function doSyncRateAt(uint32 at) internal {
    uint32 prevTick = _rateUpdatedAt;
    if (at != prevTick) {
      internalMarkRateUpdate(at);
      internalRateUpdated(_rate, prevTick, at);
    }
  }

  function getCurrentTick() internal view virtual returns (uint32);

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal {
    _accumRate += lastRate * (at - lastAt);
  }

  function internalMarkRateUpdate(uint32 currentTick) internal {
    require(currentTick >= _rateUpdatedAt, 'retroactive update');
    _rateUpdatedAt = currentTick;
  }

  function getLinearRate() internal view returns (uint256) {
    return _rate;
  }

  function getRateAndUpdatedAt() internal view returns (uint256, uint32) {
    return (_rate, _rateUpdatedAt);
  }

  function doGetReward(uint256 amount) internal returns (uint256 available) {
    available = SafeMath.sub(doCalcReward(), amount, Errors.VL_INSUFFICIENT_REWARD_AVAILABLE);
    _consumed += amount;
  }

  function doGetAllReward(uint256 limit) internal returns (uint256 available) {
    available = doCalcReward();
    if (limit < available) {
      available = limit;
    }
    _consumed += available;
    return available;
  }

  function doCalcReward() internal view returns (uint256) {
    return doCalcRewardAt(getCurrentTick());
  }

  function doCalcRewardAt(uint32 at) internal view returns (uint256) {
    return (_accumRate + (_rate * (at - _rateUpdatedAt))) - _consumed;
  }
}
