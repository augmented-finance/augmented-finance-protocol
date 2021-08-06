// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import './CalcLinearRateReward.sol';

abstract contract CalcCheckpointWeightedReward is CalcLinearRateReward {
  uint256 private _accumRate;
  mapping(uint32 => uint256) private _accumHistory;

  uint256 private constant _maxWeightBase = 1e36;

  function internalTotalSupply() internal view virtual returns (uint256);

  function internalExtraRate() internal view virtual returns (uint256);

  function doCheckpoint(uint32 at) internal {
    (uint256 lastRate, uint32 lastAt) = getRateAndUpdatedAt();
    internalMarkRateUpdate(at);
    internalRateUpdated(lastRate, lastAt, at);

    _accumHistory[at] = _accumRate + 1;
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal override {
    if (at == lastAt) {
      return;
    }

    uint256 totalSupply = internalTotalSupply();

    if (totalSupply == 0) {
      return;
    }

    lastRate = lastRate.add(internalExtraRate());
    // the rate stays in RAY, but is weighted now vs _maxWeightBase
    lastRate = lastRate.mul(_maxWeightBase.div(totalSupply));
    _accumRate = _accumRate.add(lastRate.mul(at - lastAt));
  }

  function isHistory(uint32 at) internal view virtual returns (bool);

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
      uint32 /* since */
    )
  {
    if (isHistory(at)) {
      adjRate = _accumHistory[at];
      require(adjRate > 0, 'unknown history point');
      adjRate--;
    } else {
      adjRate = _accumRate;
      uint256 totalSupply = internalTotalSupply();

      if (totalSupply > 0) {
        (uint256 rate, uint32 updatedAt) = getRateAndUpdatedAt();

        rate = rate.add(internalExtraRate());
        rate = rate.mul(_maxWeightBase.div(totalSupply));
        adjRate = adjRate.add(rate.mul(at - updatedAt));
      }
    }

    if (adjRate == lastAccumRate || entry.rewardBase == 0) {
      return (adjRate, 0, entry.claimedAt);
    }

    allocated = uint256(entry.rewardBase).mul(adjRate.sub(lastAccumRate)).div(_maxWeightBase);
    return (adjRate, allocated, entry.claimedAt);
  }
}
