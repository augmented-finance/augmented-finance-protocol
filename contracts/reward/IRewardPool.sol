// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';

interface IRewardPool is IAaveIncentivesController {
  function handleBalanceUpdate(
    address user,
    uint256 userBalance,
    uint256 totalSupply
  ) external;
}

interface IManagedRewardPool {
  function setRate(uint256 rate) external;

  function claimRewardOnBehalf(address holder) external returns (uint256);

  function calcRewardOnBehalf(address holder) external view returns (uint256);

  function addRewardProvider(address provider) external;

  function removeRewardProvider(address provider) external;
}
