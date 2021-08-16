// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './CalcLinearRewardBalances.sol';

abstract contract CalcLinearUnweightedReward is CalcLinearRewardBalances {
  uint256 private _accumRate;

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal override {
    _accumRate += lastRate * (at - lastAt);
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
      uint32 since
    )
  {
    (uint256 rate, uint32 updatedAt) = getRateAndUpdatedAt();

    adjRate = _accumRate + (rate * (at - updatedAt));
    allocated = uint256(entry.rewardBase) * (adjRate - lastAccumRate);

    return (adjRate, allocated, entry.claimedAt);
  }
}
