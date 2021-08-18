// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './CalcLinearRewardBalances.sol';

abstract contract CalcLinearWeightedReward is CalcLinearRewardBalances {
  uint256 private _accumRate;
  uint256 private _totalSupply;

  uint256 private constant _maxWeightBase = 1e36;

  function internalGetTotalSupply() internal view returns (uint256) {
    return _totalSupply;
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal override {
    if (_totalSupply == 0) {
      return;
    }

    // the rate is weighted now vs _maxWeightBase
    if (at != lastAt) {
      lastRate *= _maxWeightBase / _totalSupply;
      _accumRate += lastRate * (at - lastAt);
    }
  }

  function doUpdateTotalSupply(uint256 newSupply) internal returns (bool) {
    if (newSupply == _totalSupply) {
      return false;
    }
    return internalSetTotalSupply(newSupply, getCurrentTick());
  }

  function doIncrementTotalSupply(uint256 amount) internal {
    doUpdateTotalSupply(_totalSupply + amount);
  }

  function doDecrementTotalSupply(uint256 amount) internal {
    doUpdateTotalSupply(_totalSupply - amount);
  }

  function internalSetTotalSupply(uint256 totalSupply, uint32 at) internal returns (bool rateUpdated) {
    (uint256 lastRate, uint32 lastAt) = getRateAndUpdatedAt();
    internalMarkRateUpdate(at);

    if (lastRate > 0) {
      internalRateUpdated(lastRate, lastAt, at);
      rateUpdated = lastAt != at;
    }

    _totalSupply = totalSupply;
    return rateUpdated;
  }

  function internalGetLastAccumRate() internal view returns (uint256) {
    return _accumRate;
  }

  function internalCalcRateAndReward(
    RewardBalance memory entry,
    uint256 lastAccumRate,
    uint32 at
  )
    internal
    view
    virtual
    override
    returns (
      uint256 adjRate,
      uint256 allocated,
      uint32 /* since */
    )
  {
    adjRate = _accumRate;

    if (_totalSupply > 0) {
      (uint256 rate, uint32 updatedAt) = getRateAndUpdatedAt();

      rate *= _maxWeightBase / _totalSupply;
      adjRate += rate * (at - updatedAt);
    }

    if (adjRate == lastAccumRate || entry.rewardBase == 0) {
      return (adjRate, 0, entry.claimedAt);
    }

    allocated = (uint256(entry.rewardBase) * (adjRate - lastAccumRate)) / _maxWeightBase;
    return (adjRate, allocated, entry.claimedAt);
  }
}
