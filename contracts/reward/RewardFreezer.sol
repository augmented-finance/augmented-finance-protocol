// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';

import {BasicRewardController} from './BasicRewardController.sol';
import {IRewardMinter} from './interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

contract RewardFreezer is BasicRewardController {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  struct FrozenReward {
    uint256 frozenReward;
    uint32 lastUpdateBlock;
  }

  mapping(address => FrozenReward) private _frozenRewards;
  mapping(address => uint256) private _claimableRewards;
  uint32 private _meltdownBlock;
  uint256 private _unfrozenPortion;

  constructor(IRewardMinter rewardMinter) public BasicRewardController(rewardMinter) {}

  function admin_setFreezePortion(uint256 freezePortion) external onlyOwner {
    require(freezePortion <= WadRayMath.RAY, 'max = 1 ray = 100%');
    _unfrozenPortion = WadRayMath.RAY - freezePortion;
  }

  function admin_setMeltDownBlock(uint32 blockNumber) external onlyOwner {
    // TODO check current block
    _meltdownBlock = blockNumber;
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal override {
    allocated = internalApplyAllocated(holder, allocated, currentBlock);
    if (allocated > 0) {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal override returns (uint256 amount) {
    amount = internalApplyAllocated(holder, allocated, currentBlock);

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
    uint32 currentBlock
  ) private returns (uint256 amount) {
    if (_meltdownBlock > 0 && _meltdownBlock <= currentBlock) {
      uint256 frozenReward = _frozenRewards[holder].frozenReward;
      if (frozenReward > 0) {
        allocated = allocated.add(frozenReward);
        delete (_frozenRewards[holder]);
      }
      return allocated;
    }

    if (_unfrozenPortion < WadRayMath.RAY) {
      amount = allocated.rayMul(_unfrozenPortion);
      allocated -= amount;
    } else {
      amount = allocated;
      allocated = 0;
    }

    if (_meltdownBlock > 0) {
      uint256 frozenReward = _frozenRewards[holder].frozenReward;
      if (frozenReward > 0) {
        uint256 unfrozen =
          frozenReward.div(_meltdownBlock - _frozenRewards[holder].lastUpdateBlock).mul(
            currentBlock - _frozenRewards[holder].lastUpdateBlock
          );

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
}
