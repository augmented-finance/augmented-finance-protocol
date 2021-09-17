// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../interfaces/IDerivedToken.sol';
import '../../../interfaces/IRewardedToken.sol';
import '../../../interfaces/IUnderlyingBalance.sol';

interface IStakeToken is IDerivedToken, IRewardedToken, IUnderlyingBalance {
  event Staked(address indexed from, address indexed to, uint256 amount, uint256 indexed referal);
  event Redeemed(address indexed from, address indexed to, uint256 amount, uint256 underlyingAmount);
  event CooldownStarted(address indexed account, uint32 at);

  function stake(
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) external returns (uint256 stakeAmount);

  /**
   * @dev Redeems staked tokens, and stop earning rewards. Reverts if cooldown is not finished or is outside of the unstake window.
   * @param to Address to redeem to
   * @param stakeAmount Amount of stake to redeem
   **/
  function redeem(address to, uint256 maxStakeAmount) external returns (uint256 stakeAmount);

  /**
   * @dev Redeems staked tokens, and stop earning rewards. Reverts if cooldown is not finished or is outside of the unstake window.
   * @param to Address to redeem to
   * @param underlyingAmount Amount of underlying to redeem
   **/
  function redeemUnderlying(address to, uint256 maxUnderlyingAmount) external returns (uint256 underlyingAmount);

  /// @dev Activates the cooldown period to unstake. Reverts if the user has no stake.
  function cooldown() external;

  /// @dev Returns beginning of the current cooldown period or zero when cooldown was not triggered.
  function getCooldown(address) external view returns (uint32);

  function exchangeRate() external view returns (uint256);

  function isRedeemable() external view returns (bool);

  function getMaxSlashablePercentage() external view returns (uint16);

  function balanceAndCooldownOf(address holder)
    external
    view
    returns (
      uint256 balance,
      uint32 windowStart,
      uint32 windowEnd
    );
}
