// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';

interface IRewardPool is IAaveIncentivesController {
  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply
  ) external;
}

interface IManagedRewardPool {
  function isLazy() external view returns (bool);

  function setRate(uint256 rate) external;

  function claimRewardOnBehalf(address holder) external returns (uint256);

  function calcRewardOnBehalf(address holder) external view returns (uint256);

  function addRewardProvider(address provider) external;

  function removeRewardProvider(address provider) external;
}
