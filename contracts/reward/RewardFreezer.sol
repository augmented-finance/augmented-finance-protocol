// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/interfaces/IMarketAccessController.sol';
import '../interfaces/IRewardMinter.sol';
import './calcs/CalcLinearFreezer.sol';
import './BasicRewardController.sol';

// TODO: remove after refactoring of tests
contract RewardFreezer is BasicRewardController, CalcLinearFreezer {
  mapping(address => uint256) private _claimableRewards;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    BasicRewardController(accessController, rewardMinter)
  {}

  function setFreezePercentage(uint16 freezePortion) external onlyConfigAdmin {
    internalSetFreezePercentage(freezePortion);
  }

  function setMeltDownAt(uint32 at) external onlyConfigAdmin {
    internalSetMeltDownAt(at);
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint256,
    uint32 since
  ) internal override {
    allocated = doAllocatedByPool(holder, allocated, since);
    if (allocated > 0) {
      _claimableRewards[holder] += allocated;
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal override returns (uint256 claimableAmount, uint256 delayedAmount) {
    (claimableAmount, delayedAmount) = doClaimByPull(holder, allocated, since);

    uint256 claimableReward = _claimableRewards[holder];
    if (claimableReward > 0) {
      claimableAmount += claimableReward;
      delete (_claimableRewards[holder]);
    }

    return (claimableAmount, delayedAmount);
  }

  function internalCalcByCall(
    address holder,
    uint256 allocated,
    uint32 since,
    bool incremental
  ) internal view override returns (uint256 claimableAmount, uint256 frozenReward) {
    (claimableAmount, frozenReward) = doCalcByPull(holder, allocated, since, uint32(block.timestamp), incremental);
    claimableAmount += _claimableRewards[holder];
    return (claimableAmount, frozenReward);
  }
}
