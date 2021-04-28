// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {BasicRewardController} from './BasicRewardController.sol';
import {IRewardMinter} from './interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

contract RewardFreezer is BasicRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  struct FrozenReward {
    uint256 frozenReward;
    uint32 lastUpdateBlock;
  }

  mapping(address => FrozenReward) private _frozenRewards;
  mapping(address => uint256) private _claimableRewards;
  uint32 private _meltdownBlock;
  uint32 private _unfrozenPortion;

  constructor(IRewardMinter rewardMinter) public BasicRewardController(rewardMinter) {}

  function admin_setFreezePercentage(uint32 freezePortion) external onlyOwner {
    require(freezePortion <= PercentageMath.ONE, 'max is 10000 (100%)');
    _unfrozenPortion = PercentageMath.ONE - freezePortion;
  }

  function admin_setMeltDownBlock(uint32 blockNumber) external onlyOwner {
    // TODO check current block
    _meltdownBlock = blockNumber;
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal override {
    allocated = internalApplyAllocated(holder, allocated, sinceBlock, currentBlock);
    if (allocated > 0) {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal override returns (uint256 amount) {
    amount = internalApplyAllocated(holder, allocated, sinceBlock, currentBlock);

    uint256 claimableReward = _claimableRewards[holder];
    if (claimableReward > 0) {
      amount = amount.add(claimableReward);
      delete (_claimableRewards[holder]);
    }

    return amount;
  }

  function internalApplyAllocated(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) private returns (uint256 amount) {
    console.log('internalApplyAllocated ', _meltdownBlock, _unfrozenPortion, allocated);

    if (_meltdownBlock > 0 && _meltdownBlock <= currentBlock) {
      uint256 frozenReward = _frozenRewards[holder].frozenReward;
      if (frozenReward > 0) {
        allocated = allocated.add(frozenReward);
        delete (_frozenRewards[holder]);
      }
      return allocated;
    }

    if (_unfrozenPortion < PercentageMath.ONE) {
      amount = allocated.percentMul(_unfrozenPortion);
      allocated -= amount;
    } else {
      amount = allocated;
      allocated = 0;
    }

    if (_meltdownBlock > 0) {
      if (allocated > 0 && sinceBlock != 0 && sinceBlock < currentBlock) {
        // portion of the allocated was already unfreezed
        uint256 unfrozen = calcUnfrozenByEmmission(allocated, sinceBlock, currentBlock);
        if (unfrozen > 0) {
          amount = amount.add(unfrozen);
          allocated = allocated.sub(unfrozen);
        }
      }

      uint256 frozenReward = _frozenRewards[holder].frozenReward;
      if (frozenReward > 0) {
        uint256 unfrozen =
          calcUnfrozen(frozenReward, _frozenRewards[holder].lastUpdateBlock, currentBlock);
        if (unfrozen > 0) {
          amount = amount.add(unfrozen);
          _frozenRewards[holder].frozenReward = frozenReward.sub(unfrozen);
          _frozenRewards[holder].lastUpdateBlock = currentBlock;
        }
      }
    }

    if (allocated > 0) {
      _frozenRewards[holder].frozenReward = _frozenRewards[holder].frozenReward.add(allocated);
    }
    return amount;
  }

  function calcUnfrozen(
    uint256 frozenReward,
    uint32 lastUpdatedBlock,
    uint32 currentBlock
  ) private view returns (uint256) {
    return frozenReward.div(_meltdownBlock - lastUpdatedBlock).mul(currentBlock - lastUpdatedBlock);
  }

  function calcUnfrozenByEmmission(
    uint256 emittedReward,
    uint32 lastUpdatedBlock,
    uint32 currentBlock
  ) private view returns (uint256) {
    return
      emittedReward.div(_meltdownBlock - lastUpdatedBlock).mul(
        (currentBlock - lastUpdatedBlock + 1) >> 1
      );
  }
}
