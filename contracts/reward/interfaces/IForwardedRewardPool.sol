// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

interface IForwardedRewardPool {
  function getRewardRate() external view returns (uint256);

  function setRewardRate(uint256) external;

  function calcReward(address holder) external view returns (uint256 amount, uint32 since);

  function claimReward(address holder) external returns (uint256 amount, uint32 since);
}
