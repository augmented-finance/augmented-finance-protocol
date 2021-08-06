// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

interface IRewardExplainer {
  function explainReward(address holder, uint32 at) external view returns (RewardExplained memory);
}

struct RewardExplained {
  uint256 amountClaimable;
  uint256 amountExtra;
  uint256 maxBoost;
  uint256 boostLimit;
  RewardExplainEntry[] allocations;
}

enum RewardType {WorkReward, BoostReward}

struct RewardExplainEntry {
  uint256 amount;
  address pool;
  uint32 since;
  uint32 factor;
  RewardType rewardType;
}
