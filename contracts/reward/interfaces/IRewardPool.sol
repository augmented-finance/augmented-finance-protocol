// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

interface IRewardPool is IBalanceHook {}

interface IManagedRewardPool {
  function isLazy() external view returns (bool);

  function updateBaseline(uint256) external;

  function setBaselinePercentage(uint256) external;

  function disableBaseline() external;

  function setRate(uint256 rate) external;

  function claimRewardFor(address holder) external returns (uint256);

  function calcRewardFor(address holder) external view returns (uint256);

  function addRewardProvider(address provider) external;

  function removeRewardProvider(address provider) external;
}
