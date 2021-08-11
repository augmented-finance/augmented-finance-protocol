// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../tools/math/PercentageMath.sol';

import '../access/interfaces/IMarketAccessController.sol';
import './BasicRewardController.sol';
import './calcs/CalcLinearFreezer.sol';
import '../interfaces/IRewardMinter.sol';

// TODO: remove after refactoring of tests
contract RewardFreezer is BasicRewardController, CalcLinearFreezer {
  using SafeMath for uint256;
  using PercentageMath for uint256;

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
    address,
    uint32 since
  ) internal override {
    allocated = doAllocatedByPool(holder, allocated, since);
    if (allocated > 0) {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
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
      claimableAmount = claimableAmount.add(claimableReward);
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
    (claimableAmount, frozenReward) = doCalcByPull(
      holder,
      allocated,
      since,
      uint32(block.timestamp),
      incremental
    );
    claimableAmount = claimableAmount.add(_claimableRewards[holder]);
    return (claimableAmount, frozenReward);
  }
}
