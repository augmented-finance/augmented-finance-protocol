// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
// import {Aclable} from '../misc/Aclable.sol';

import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract RewardFreezer is Ownable, IRewardController {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IERC20 private _rewardToken; // TODO mint-able
  mapping(address => IManagedRewardPool) private _pools;
  IManagedRewardPool[] private _poolList;

  struct AllocatedReward {
    uint256 frozenReward;
    uint32 lastUpdateBlock;
  }
  mapping(address => AllocatedReward) private _rewards;
  uint32 _unfreezeBlock;
  uint256 _unfrozenPortion;

  function claimReward() external returns (uint256) {
    return internalClaimReward(msg.sender);
  }

  function claimRewardOnBehalf(address holder) external returns (uint256 amount) {
    // uint256 allocated = 0;
    // for (uint256 i = 0; i < _poolList.length; i++) {
    //     allocated = allocated.add(_poolList[i].claimRewardOnBehalf(holder));
    // }

    // if (_unfrozenPortion > 0) {
    //     amount = allocated.rayMul(_unfrozenPortion);
    //     allocated -= amount;
    // }

    // amount = amount.add(internalUseFreezer(holder, allocated, uint32(block.number)));
    // if (amount > 0) {
    //     // todo mint
    // }

    return amount;
  }

  function internalClaimReward(address holder) private returns (uint256 amount) {
    return 0;
  }

  function internalUseFreezer(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal returns (uint256) {
    if (_unfreezeBlock == 0) {
      if (allocated > 0) {
        _rewards[holder].frozenReward = _rewards[holder].frozenReward.add(allocated);
      }
      return 0;
    }

    if (_unfreezeBlock <= currentBlock) {
      uint256 frozenReward = _rewards[holder].frozenReward;
      if (frozenReward > 0) {
        allocated = allocated.add(frozenReward);
        delete (_rewards[holder]);
      }
      return allocated;
    }

    AllocatedReward storage reward = _rewards[holder];

    uint256 unfrozen =
      reward.frozenReward.div(_unfreezeBlock - reward.lastUpdateBlock).mul(
        currentBlock - reward.lastUpdateBlock
      );
    if (unfrozen == 0) {
      return allocated;
    }
    reward.frozenReward = reward.frozenReward.sub(unfrozen);
    //        reward.unclaimedReward = reward.unclaimedReward.add(unfrozen);
    reward.lastUpdateBlock = currentBlock;
    return allocated;
  }
}
