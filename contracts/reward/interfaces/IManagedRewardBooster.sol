// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IManagedRewardController} from './IRewardController.sol';

interface IManagedRewardBooster is IManagedRewardController {
  function setUpdateBoostPoolRate(bool) external;

  function setBoostPool(address) external;

  function setBoostExcessTarget(address target, bool mintExcess) external;
}
