// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IManagedRewardPool} from './IRewardPool.sol';
import {IRewardMinter} from '../../interfaces/IRewardMinter.sol';

enum AllocationMode {Push, SetPull, UnsetPull}

interface IRewardController {
  function allocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    AllocationMode mode
  ) external;

  function isRateController(address) external view returns (bool);

  function isConfigurator(address) external view returns (bool);
}

interface IManagedRewardController is IRewardController {
  function updateBaseline(uint256 baseline) external;

  function admin_addRewardPool(IManagedRewardPool) external;

  function admin_removeRewardPool(IManagedRewardPool) external;

  function admin_setRewardMinter(IRewardMinter) external;
}
