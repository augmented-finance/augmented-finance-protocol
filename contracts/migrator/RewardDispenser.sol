// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IRewardDispenser} from './interfaces/IRewardDispenser.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';

import 'hardhat/console.sol';

contract RewardDispenser is IRewardDispenser, Ownable {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 constant aclRewardForMigrate = 1 << 0;

  /* Pool */
  mapping(address => RewardPool) private _rewardPools;
  struct RewardPool {
    uint256 accumRate;
    uint256 blockRate; // rays, linear
    uint32 lastUpdateBlock;
  }

  struct UserReward {
    uint256 mintingBase;
    uint256 frozenReward;
    uint256 unclaimedReward;
    //Xsolium-disable-next-line
    //reserve.lastUpdateTimestamp = uint40(block.timestamp);
    uint32 lastUpdateBlock;
  }

  mapping(address => UserReward) private _rewards;
  uint32 _migratedBlock;
  uint32 _unfreezeBlock;

  function claimReward(address holder) external returns (uint256 amount) {
    amount = internalClaimReward(holder, uint32(block.number));
    if (amount > 0) {
      // TODO mint token
    }
    return amount;
  }

  function internalClaimReward(address holder, uint32 currentBlock)
    internal
    returns (uint256 amount)
  {
    UserReward memory reward = _rewards[holder];

    if (reward.lastUpdateBlock > 0 && reward.lastUpdateBlock < currentBlock) {
      internalUnfreezeReward(reward, currentBlock);

      (uint256 claimableAmount, uint256 frozenAmount) = internalClaimMints(reward, currentBlock);

      reward.frozenReward = reward.frozenReward.add(frozenAmount);
      amount = reward.unclaimedReward.add(claimableAmount);
    } else {
      amount = reward.unclaimedReward;
    }

    if (reward.frozenReward > 0 || reward.lastUpdateBlock > 0) {
      reward.unclaimedReward = 0;
      reward.lastUpdateBlock = currentBlock;
      _rewards[holder] = reward;
    }
    return amount;
  }

  function internalClaimMints(UserReward memory reward, uint32 currentBlock)
    internal
    returns (uint256 claimableAmount, uint256 frozenAmount)
  {
    if (_migratedBlock != 0 && reward.lastUpdateBlock <= _migratedBlock) {
      // calc till _migratedBlock
      // needs new mint-ratio
      reward.mintingBase = 0;
    }
    //      if _rewardBeforeMigrate[holder].lastUpdateBlock == 0 && _rewardAfterMigrate[holder].lastUpdateBlock == 0
  }

  function internalUnfreezeReward(UserReward memory reward, uint32 currentBlock) internal {
    if (reward.frozenReward == 0 || _unfreezeBlock == 0) {
      return;
    }

    if (_unfreezeBlock < currentBlock) {
      reward.unclaimedReward = reward.unclaimedReward.add(reward.frozenReward);
      reward.frozenReward = 0;
      return;
    }

    uint256 unfrozen =
      reward.frozenReward.div(_unfreezeBlock - reward.lastUpdateBlock).mul(
        currentBlock - reward.lastUpdateBlock
      );
    if (unfrozen == 0) {
      return;
    }
    reward.frozenReward = reward.frozenReward.sub(unfrozen);
    reward.unclaimedReward = reward.unclaimedReward.add(unfrozen);
    reward.lastUpdateBlock = currentBlock;
  }

  function rewardBalance(address holder) public view returns (uint256) {
    if (_rewards[holder].lastUpdateBlock == 0) {
      return 0;
    }
    UserReward memory reward = _rewards[holder];
    // updateUserReward(reward);
    return reward.unclaimedReward;
  }

  // function rewardUser(UserReward memory reward) public returns (bool expired) {
  // }

  // function updateUserReward(UserReward memory reward) private view returns (bool expired) {
  //   if (uint32(block.number) == reward.lastUpdateBlock) {
  //     return false; // TODO ?
  //   }
  //   require(reward.lastUpdateBlock > 0, 'illegal reward data');

  //   (RewardScheduleEntry storage entry, uint256 entryBlockNumber) = getRewardSchedule(block.number);
  //   if (block.number < entryBlockNumber) {
  //     return false; // TODO ?
  //   }
  //   // TODO prevEntry
  //   //        reward.unclaimedReward += reward.rewardBase.rayMul(entry.accumulatedFactor - prevEntry.accumulatedFactor);
  //   reward.unclaimedReward += reward.mintingBase.rayMul(
  //     entry.perBlockFactor.mul(block.number.sub(uint256(reward.lastUpdateBlock)))
  //   );
  // }

  // function getRewardSchedule(uint256 blockNumber)
  //   private
  //   view
  //   returns (RewardScheduleEntry storage entry, uint256 blockNumber_)
  // {
  //   if (blockNumber >= _scheduleLast) {
  //     blockNumber_ = _scheduleLast;
  //   } else if (blockNumber <= _scheduleStart) {
  //     blockNumber_ = _scheduleStart;
  //   } else {
  //     blockNumber_ = blockNumber - (blockNumber % _scheduleStep);
  //   }
  //   entry = _schedule[blockNumber_];
  //   require(
  //     entry.accumulatedFactor > 0 || entry.perBlockFactor > 0,
  //     'illegal reward schedule entry'
  //   );
  //   return (entry, blockNumber_);
  // }
}

// struct RewardScheduleEntry {
//   // accumulatedFactor for minting, is nominated in ray
//   uint256 accumulatedFactor;
//   // perBlockFactor for minting, is nominated in ray
//   uint256 perBlockFactor;
// }

// mapping(uint256 => RewardScheduleEntry) private _schedule;
// uint256 private _scheduleStart;
// uint256 private _scheduleStep;
// uint256 private _scheduleLast;
