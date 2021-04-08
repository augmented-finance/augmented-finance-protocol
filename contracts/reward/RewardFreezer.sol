// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';

import {BasicRewardController} from './BasicRewardController.sol';
import {IRewardMinter} from './IRewardMinter.sol';

import 'hardhat/console.sol';

contract RewardFreezer is BasicRewardController {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  struct RewardRecord {
    uint256 claimableReward;
    uint256 frozenReward;
    uint32 lastUpdateBlock;
  }

  mapping(address => RewardRecord) private _rewards;
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
      _rewards[holder].claimableReward = _rewards[holder].claimableReward.add(allocated);
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal override returns (uint256 amount) {
    amount = internalApplyAllocated(holder, allocated, currentBlock);

    if (_rewards[holder].claimableReward > 0) {
      amount = amount.add(_rewards[holder].claimableReward);
      _rewards[holder].claimableReward = 0;
    }

    return amount;
  }

  function internalApplyAllocated(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) private returns (uint256 amount) {
    if (_meltdownBlock > 0 && _meltdownBlock <= currentBlock) {
      if (_rewards[holder].frozenReward > 0) {
        allocated = allocated.add(_rewards[holder].frozenReward);
        _rewards[holder].frozenReward = 0;
      }
      return allocated;
    }

    if (_unfrozenPortion > 0) {
      amount = allocated.rayMul(_unfrozenPortion);
      allocated -= amount;
    }

    if (_meltdownBlock > 0) {
      uint256 frozenReward = _rewards[holder].frozenReward;
      uint256 unfrozen =
        frozenReward.div(_meltdownBlock - _rewards[holder].lastUpdateBlock).mul(
          currentBlock - _rewards[holder].lastUpdateBlock
        );

      if (unfrozen > 0) {
        amount = amount.add(unfrozen);
        _rewards[holder].frozenReward = frozenReward.sub(unfrozen);
        _rewards[holder].lastUpdateBlock = currentBlock;
      }
    }

    if (allocated > 0) {
      _rewards[holder].frozenReward = _rewards[holder].frozenReward.add(allocated);
    }
    return amount;
  }
}
