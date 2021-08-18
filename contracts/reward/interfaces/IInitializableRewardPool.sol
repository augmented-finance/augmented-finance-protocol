// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IRewardController.sol';

interface IInitializableRewardPool {
  struct InitData {
    IRewardController controller;
    string poolName;
    uint16 baselinePercentage;
  }

  function initialize(InitData calldata) external;

  function initializedRewardPoolWith() external view returns (InitData memory);
}
