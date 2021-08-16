// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardController.sol';
import '../calcs/CalcLinearWeightedReward.sol';
import './BaseTokenAbsRewardPool.sol';

contract TokenWeightedRewardPool is BaseTokenAbsRewardPool, CalcLinearWeightedReward {
  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) BaseTokenAbsRewardPool(controller, initialRate, baselinePercentage) CalcLinearWeightedReward() {}

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate) internal override {
    super.setLinearRate(newRate);
  }

  function internalGetReward(address holder, uint256) internal override returns (uint256, uint32) {
    return doGetReward(holder);
  }

  function internalCalcReward(address holder, uint32 at) internal view override returns (uint256, uint32) {
    return doCalcRewardAt(holder, at);
  }

  function internalUpdateReward(
    address,
    address holder,
    uint256,
    uint256 newBalance
  )
    internal
    override
    returns (
      uint256 allocated,
      uint32 since,
      AllocationMode mode
    )
  {
    return doUpdateRewardBalance(holder, newBalance);
  }

  function internalUpdateTotal(uint256 totalBalance) internal override {
    doUpdateTotalSupply(totalBalance);
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }
}
