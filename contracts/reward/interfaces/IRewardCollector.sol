// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRewardCollector {
  /// @dev claims rewards of the caller and transfers to the caller
  /// @return claimed amount of rewards
  /// @return locked amount is portion of rewards that was locked
  function claimReward() external returns (uint256 claimed, uint256 locked);

  /// @dev claims rewards of the caller and transfers to the receiver
  /// @return claimed amount of rewards
  /// @return locked amount is portion of rewards that was locked (on the receiver)
  function claimRewardTo(address receiver) external returns (uint256 claimed, uint256 locked);

  /// @dev calculates rewards of the caller
  /// @return claimable amount of rewards, it matches the claimed amount returned by claimReward()
  /// @return frozen amount rewards that was allocated, but will be released gradually (doesn't math the locked reward)
  function claimableReward(address holder) external view returns (uint256 claimable, uint256 frozen);

  /// @dev calculates rewards of the caller. Returns (claimable + frozen) amounts of claimableReward()
  function balanceOf(address holder) external view returns (uint256);
}
