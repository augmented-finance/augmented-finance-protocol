// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import './CalcLinearRateReward.sol';

abstract contract CalcLinearUnweightedReward is CalcLinearRateReward {
  uint256 private _accumRate;

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal override {
    _accumRate = _accumRate.add(lastRate.mul(at - lastAt));
  }

  function internalCalcRateAndReward(
    RewardEntry memory entry,
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

    adjRate = _accumRate.add(rate.mul(at - updatedAt));
    allocated = uint256(entry.rewardBase).mul(adjRate.sub(lastAccumRate));

    return (adjRate, allocated, entry.claimedAt);
  }
}
