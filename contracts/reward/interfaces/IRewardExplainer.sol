// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IManagedRewardPool} from './IManagedRewardPool.sol';
import {IRewardMinter} from '../../interfaces/IRewardMinter.sol';
import {IEmergencyAccess} from '../../interfaces/IEmergencyAccess.sol';

interface IRewardExplainer {
  function explainReward(address holder) external view returns (RewardExplained memory);
}

struct RewardExplained {
  uint256 amountProvided;
  uint256 amountRetained;
  RewardExplainEntry[] entries;
}

enum RewardType {WorkReward, BoostReward, FrozenReward, LockedReward}

struct RewardExplainEntry {
  address origin;
  uint256 amount;
  uint32 since;
  RewardType rewardType;
  bool retained;
}
