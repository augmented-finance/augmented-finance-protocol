// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/PercentageMath.sol';
import {AllocationMode} from '../interfaces/IRewardController.sol';

abstract contract CalcLinearFreezer {
  using PercentageMath for uint256;

  struct FrozenReward {
    uint224 frozenReward;
    uint32 lastUpdatedAt;
  }

  mapping(address => FrozenReward) private _frozenRewards;
  uint32 private _meltdownAt;
  uint16 private _unfrozenPortion;

  function internalSetFreezePercentage(uint16 freezePortion) internal {
    _unfrozenPortion = PercentageMath.ONE - freezePortion;
  }

  function getFreezePercentage() public view returns (uint16) {
    return PercentageMath.ONE - _unfrozenPortion;
  }

  function internalSetMeltDownAt(uint32 at) internal {
    require(_meltdownAt == 0 || _meltdownAt > block.timestamp);
    _meltdownAt = at;
  }

  function getMeltDownAt() public view returns (uint32) {
    return _meltdownAt;
  }

  function doAllocatedByPush(
    address holder,
    uint256 allocated,
    uint32 since
  )
    internal
    returns (
      uint256,
      uint32,
      AllocationMode
    )
  {
    uint256 frozenBefore = _frozenRewards[holder].frozenReward;

    (allocated, ) = internalApplyAllocated(holder, allocated, since, uint32(block.timestamp));

    AllocationMode mode = AllocationMode.Push;
    if (frozenBefore == 0 && _frozenRewards[holder].frozenReward > 0) {
      mode = AllocationMode.SetPull;
    }

    return (allocated, uint32(block.timestamp), mode);
  }

  function doAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal returns (uint256) {
    (allocated, ) = internalApplyAllocated(holder, allocated, since, uint32(block.timestamp));
    return allocated;
  }

  function doClaimByPull(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal returns (uint256 claimableAmount, uint256 delayedAmount) {
    return internalApplyAllocated(holder, allocated, since, uint32(block.timestamp));
  }

  enum FrozenRewardState {
    NotRead,
    Read,
    Updated,
    Remove
  }

  function internalCalcAllocated(
    address holder,
    uint256 allocated,
    uint32 since,
    uint32 current,
    bool incremental
  )
    private
    view
    returns (
      uint256 amount,
      uint256 frozenReward,
      FrozenRewardState state
    )
  {
    if (_meltdownAt > 0 && _meltdownAt <= current) {
      if (incremental) {
        return (allocated, 0, FrozenRewardState.NotRead);
      }
      frozenReward = _frozenRewards[holder].frozenReward;
      if (frozenReward == 0) {
        return (allocated, 0, FrozenRewardState.Read);
      }
      allocated = allocated + frozenReward;
      return (allocated, 0, FrozenRewardState.Remove);
    }

    if (_unfrozenPortion < PercentageMath.ONE) {
      amount = allocated.percentMul(_unfrozenPortion);
      allocated -= amount;
    } else {
      amount = allocated;
      allocated = 0;
    }

    if (_meltdownAt > 0) {
      if (allocated > 0 && since != 0 && since < current) {
        // portion of the allocated was already unfreezed
        uint256 unfrozen = calcUnfrozenDuringEmmission(allocated, since, current);
        if (unfrozen > 0) {
          amount += unfrozen;
          allocated -= unfrozen;
        }
      }

      if (!incremental) {
        frozenReward = _frozenRewards[holder].frozenReward;
        state = FrozenRewardState.Read;

        if (frozenReward > 0) {
          uint256 unfrozen = calcUnfrozen(frozenReward, _frozenRewards[holder].lastUpdatedAt, current);
          if (unfrozen > 0) {
            amount += unfrozen;
            frozenReward -= unfrozen;
            state = FrozenRewardState.Updated;
          }
        }
      }
    }

    if (allocated > 0) {
      if (state == FrozenRewardState.NotRead && !incremental) {
        frozenReward = _frozenRewards[holder].frozenReward;
      }
      frozenReward += allocated;
      require(frozenReward <= type(uint224).max, 'reward is too high');
      state = FrozenRewardState.Updated;
    }

    return (amount, frozenReward, state);
  }

  function internalApplyAllocated(
    address holder,
    uint256 allocated,
    uint32 since,
    uint32 current
  ) private returns (uint256, uint256) {
    uint256 frozenBefore = _frozenRewards[holder].frozenReward;

    (uint256 amount, uint256 frozenReward, FrozenRewardState state) = internalCalcAllocated(
      holder,
      allocated,
      since,
      current,
      false
    );

    if (state == FrozenRewardState.Updated) {
      // was updated
      _frozenRewards[holder].frozenReward = uint224(frozenReward);
      _frozenRewards[holder].lastUpdatedAt = current;
    } else if (state == FrozenRewardState.Remove) {
      delete (_frozenRewards[holder]);
    }

    if (frozenBefore < frozenReward) {
      frozenReward = frozenReward - frozenBefore;
    } else {
      frozenReward = 0;
    }

    return (amount, frozenReward);
  }

  function calcUnfrozen(
    uint256 frozenReward,
    uint32 lastUpdatedAt,
    uint32 current
  ) private view returns (uint256) {
    return (frozenReward * (current - lastUpdatedAt)) / (_meltdownAt - lastUpdatedAt);
  }

  function calcUnfrozenDuringEmmission(
    uint256 emittedReward,
    uint32 lastUpdatedAt,
    uint32 current
  ) private view returns (uint256) {
    return (emittedReward * ((current - lastUpdatedAt + 1) >> 1)) / (_meltdownAt - lastUpdatedAt);
  }

  function doCalcByPull(
    address holder,
    uint256 allocated,
    uint32 since,
    uint32 at,
    bool incremental
  ) internal view returns (uint256 claimableAmount, uint256 frozenReward) {
    uint256 frozenBefore = _frozenRewards[holder].frozenReward;

    (claimableAmount, frozenReward, ) = internalCalcAllocated(holder, allocated, since, at, incremental);

    if (frozenBefore < frozenReward) {
      frozenReward = frozenReward - frozenBefore;
    } else {
      frozenReward = 0;
    }

    return (claimableAmount, frozenReward);
  }

  function internalGetFrozenReward(address holder) internal view returns (uint256) {
    return _frozenRewards[holder].frozenReward;
  }
}
