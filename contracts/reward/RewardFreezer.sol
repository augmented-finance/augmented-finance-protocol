// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BasicRewardController} from './BasicRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

contract RewardFreezer is BasicRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  struct FrozenReward {
    uint224 frozenReward;
    uint32 lastUpdatedAt;
  }

  mapping(address => FrozenReward) private _frozenRewards;
  mapping(address => uint256) private _claimableRewards;
  uint32 private _meltdownAt;
  uint32 private _unfrozenPortion;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    public
    BasicRewardController(accessController, rewardMinter)
  {}

  function admin_setFreezePercentage(uint32 freezePortion) external onlyConfigurator {
    require(freezePortion <= PercentageMath.ONE, 'max is 10000 (100%)');
    _unfrozenPortion = PercentageMath.ONE - freezePortion;
  }

  function admin_setMeltDownAt(uint32 at) external onlyConfigurator {
    require(_meltdownAt == 0 || _meltdownAt > block.timestamp);
    _meltdownAt = at;
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    address,
    uint32 since
  ) internal override {
    allocated = internalApplyAllocated(holder, allocated, since, uint32(block.timestamp));
    if (allocated > 0) {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal override returns (uint256 amount) {
    amount = internalApplyAllocated(holder, allocated, since, uint32(block.timestamp));

    uint256 claimableReward = _claimableRewards[holder];
    if (claimableReward > 0) {
      amount = amount.add(claimableReward);
      delete (_claimableRewards[holder]);
    }

    return amount;
  }

  enum FrozenRewardState {NotRead, Read, Updated, Remove}

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
      allocated = allocated.add(frozenReward);
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
        uint256 unfrozen = calcUnfrozenByEmmission(allocated, since, current);
        if (unfrozen > 0) {
          amount = amount.add(unfrozen);
          allocated = allocated.sub(unfrozen);
        }
      }

      if (!incremental) {
        frozenReward = _frozenRewards[holder].frozenReward;
        state = FrozenRewardState.Read;

        if (frozenReward > 0) {
          uint256 unfrozen =
            calcUnfrozen(frozenReward, _frozenRewards[holder].lastUpdatedAt, current);
          if (unfrozen > 0) {
            amount = amount.add(unfrozen);
            frozenReward = frozenReward.sub(unfrozen);
            state = FrozenRewardState.Updated;
          }
        }
      }
    }

    if (allocated > 0) {
      if (state == FrozenRewardState.NotRead && !incremental) {
        frozenReward = _frozenRewards[holder].frozenReward;
      }
      frozenReward = frozenReward.add(allocated);
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
  ) private returns (uint256) {
    (uint256 amount, uint256 frozenReward, FrozenRewardState state) =
      internalCalcAllocated(holder, allocated, since, current, false);

    if (state == FrozenRewardState.Updated) {
      // was updated
      _frozenRewards[holder].frozenReward = uint224(frozenReward);
      _frozenRewards[holder].lastUpdatedAt = current;
    } else if (state == FrozenRewardState.Remove) {
      delete (_frozenRewards[holder]);
    }
    return amount;
  }

  function calcUnfrozen(
    uint256 frozenReward,
    uint32 lastUpdatedAt,
    uint32 current
  ) private view returns (uint256) {
    return frozenReward.div(_meltdownAt - lastUpdatedAt).mul(current - lastUpdatedAt);
  }

  function calcUnfrozenByEmmission(
    uint256 emittedReward,
    uint32 lastUpdatedAt,
    uint32 current
  ) private view returns (uint256) {
    return emittedReward.div(_meltdownAt - lastUpdatedAt).mul((current - lastUpdatedAt + 1) >> 1);
  }

  function internalCalcByCall(
    address holder,
    uint256 allocated,
    uint32 since,
    bool incremental
  ) internal view override returns (uint256 claimableAmount, uint256 frozenAmount) {
    (claimableAmount, frozenAmount, ) = internalCalcAllocated(
      holder,
      allocated,
      since,
      uint32(block.timestamp),
      incremental
    );

    return (claimableAmount, frozenAmount);
  }
}
