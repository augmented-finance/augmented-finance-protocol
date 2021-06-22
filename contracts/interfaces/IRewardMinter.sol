// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

interface IRewardMinter {
  /**
   * @dev mints a reward. When the target is a stake token, it can return underlying, for which mintReward should also be called by the caller.
   */
  function mintReward(
    address holder,
    uint256 amount,
    bool serviceAccount
  ) external returns (IRewardMinter underlying, address mintTo);

  function rewardTotalSupply() external view returns (uint256);
}
