// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IRewardPool} from './IRewardPool.sol';

interface IRewardController {
  function allocatedByPool(address holder, uint256 allocated) external;

  function removedFromPool(address holder) external;

  event RewardsAllocated(address user, uint256 amount);
  event RewardsClaimed(address user, address to, uint256 amount);
}
