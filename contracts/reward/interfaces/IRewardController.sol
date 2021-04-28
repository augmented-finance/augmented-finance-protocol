// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IRewardPool} from './IRewardPool.sol';

interface IRewardController {
  function allocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock
  ) external;

  function removedFromPool(address holder) external;

  function isRateController(address) external returns (bool);
}
