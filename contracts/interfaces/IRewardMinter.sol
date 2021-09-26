// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRewardMinter {
  /// @dev mints a reward
  function mintReward(
    address account,
    uint256 amount,
    bool serviceAccount
  ) external;

  event RewardAllocated(address provider, int256 amount);

  /// @dev lumpsum allocation (not mint) of reward
  function allocateReward(address provider, int256 amount) external;

  event RewardMaxRateUpdated(address provider, uint256 ratePerSecond);

  /// @dev sets max allocation rate (not mint) of reward
  function streamReward(address provider, uint256 ratePerSecond) external;

  function allocatedSupply() external view returns (uint256);

  function mintedSupply() external view returns (uint256);
}
