// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRewardCollector {
  /// @dev Claims rewards of the caller and transfers to the caller
  /// @return claimed amount of rewards
  /// @return locked amount is portion of rewards that was locked
  function claimReward() external returns (uint256 claimed, uint256 locked);

  /// @dev Claims rewards of the caller and transfers to the receiver
  /// @param receiver of the claimed rewards
  /// @param includeMask provides additional reward pools to be specifically checked for rewards (will not fail on wrong pools)
  /// @return claimed amount of rewards
  /// @return locked amount is portion of rewards that was locked. These amount is also locked on the receiver
  function claimRewardTo(address receiver, uint256 includeMask) external returns (uint256 claimed, uint256 locked);

  /// @dev Calculates rewards of the holder
  /// @param holder of funds to be accounted for rewards
  /// @return claimable amount of rewards, it matches the claimed amount returned by claimReward()
  /// @return frozen amount rewards that was allocated, but will be released later (doesn't match the locked reward)
  function claimableReward(address holder) external view returns (uint256 claimable, uint256 frozen);

  /// @dev Calculates rewards of the caller
  /// @param holder of funds to be accounted for rewards
  /// @param includeMask provides additional reward pools to be specifically checked for rewards (will not fail on wrong pools)
  /// @return claimable amount of rewards, it matches the claimed amount returned by claimReward()
  /// @return frozen amount rewards that was allocated, but will be released later (doesn't match the locked reward)
  function claimableRewardFor(address holder, uint256 includeMask)
    external
    view
    returns (uint256 claimable, uint256 frozen);

  /// @dev Calculates rewards of the caller. Returns (claimable + frozen) amounts of claimableReward()
  function balanceOf(address holder) external view returns (uint256);

  /// @dev Returns set of pools (bitmask) where the holder has rewarding balances.
  function claimablePools(address holder) external view returns (uint256);

  /// @dev Caller enforces the given pools to be included into the next claim. Pools will be excluded if there will be no rewarding balance.
  /// @param includeMask provides additional reward pools to be specifically checked for rewards (will not fail on wrong pools)
  function setClaimablePools(uint256 includeMask) external;

  /// @dev Returns mask for the given pool, or zero when the pool is unknown
  function getPoolMask(address pool) external view returns (uint256);

  /// @dev Returns known pools for the given mask, unknown or removed entries are not included
  function getPoolsByMask(uint256 mask) external view returns (address[] memory);
}
