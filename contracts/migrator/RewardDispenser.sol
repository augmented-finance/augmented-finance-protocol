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

  struct UserReward {
    uint256 mintingBase;
    uint256 frozenReward;
    uint256 unclaimedReward;
    //Xsolium-disable-next-line
    //reserve.lastUpdateTimestamp = uint40(block.timestamp);
    uint32 lastUpdateBlock;
  }

  mapping(address => UserReward) private _rewards;
  uint32 _unfreezeBlock;

  struct RewardScheduleEntry {
    /// @dev accumulatedFactor for minting, is nominated in ray
    uint256 accumulatedFactor;
    /// @dev perBlockFactor for minting, is nominated in ray
    uint256 perBlockFactor;
  }

  mapping(uint256 => RewardScheduleEntry) private _schedule;
  uint256 private _scheduleStart;
  uint256 private _scheduleStep;
  uint256 private _scheduleLast;

  function claimReward(address holder) external returns (uint256) {
    if (_rewards[holder].lastUpdateBlock == 0) {
      return 0;
    }
    UserReward memory reward = _rewards[holder];
    bool expired = updateUserReward(reward);
    uint256 amount = reward.unclaimedReward;

    if (expired) {
      delete (_rewards[holder]);
    } else {
      reward.unclaimedReward = 0;
      _rewards[holder] = reward;
    }
    if (amount == 0) {
      return 0;
    }
    // TODO mint and transfer a reward token
    return amount;
  }

  function rewardBalance(address holder) public view returns (uint256) {
    if (_rewards[holder].lastUpdateBlock == 0) {
      return 0;
    }
    UserReward memory reward = _rewards[holder];
    updateUserReward(reward);
    return reward.unclaimedReward;
  }

  // function rewardUser(UserReward memory reward) public returns (bool expired) {
  // }

  function updateUserReward(UserReward memory reward) private view returns (bool expired) {
    if (uint32(block.number) == reward.lastUpdateBlock) {
      return false; // TODO ?
    }
    require(reward.lastUpdateBlock > 0, 'illegal reward data');

    (RewardScheduleEntry storage entry, uint256 entryBlockNumber) = getRewardSchedule(block.number);
    if (block.number < entryBlockNumber) {
      return false; // TODO ?
    }
    // TODO prevEntry
    //        reward.unclaimedReward += reward.rewardBase.rayMul(entry.accumulatedFactor - prevEntry.accumulatedFactor);
    reward.unclaimedReward += reward.mintingBase.rayMul(
      entry.perBlockFactor.mul(block.number.sub(uint256(reward.lastUpdateBlock)))
    );
  }

  function getRewardSchedule(uint256 blockNumber)
    private
    view
    returns (RewardScheduleEntry storage entry, uint256 blockNumber_)
  {
    if (blockNumber >= _scheduleLast) {
      blockNumber_ = _scheduleLast;
    } else if (blockNumber <= _scheduleStart) {
      blockNumber_ = _scheduleStart;
    } else {
      blockNumber_ = blockNumber - (blockNumber % _scheduleStep);
    }
    entry = _schedule[blockNumber_];
    require(
      entry.accumulatedFactor > 0 || entry.perBlockFactor > 0,
      'illegal reward schedule entry'
    );
    return (entry, blockNumber_);
  }
}
