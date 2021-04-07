// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IRewardPool {
  function updateRewardOnBehalf(address holder, uint256 newRewardBase) external;
}

interface IManagedRewardPool {
  function setPoolMask(uint256 mask) external;

  function setBlockRate(uint256 blockRate) external;

  function claimRewardOnBehalf(address holder) external;

  function calcRewardOnBehalf(address holder) external view;

  function addRewardProvider(address provider) external;

  function removeRewardProvider(address provider) external;
}
