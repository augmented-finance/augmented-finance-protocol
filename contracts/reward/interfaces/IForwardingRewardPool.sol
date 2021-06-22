// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {AllocationMode} from './IRewardController.sol';

interface IForwardingRewardPool {
  function allocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) external;
}
