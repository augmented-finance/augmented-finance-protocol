// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../interfaces/IDerivedToken.sol';
import '../../../interfaces/IRewardedToken.sol';

interface IStakeToken is IDerivedToken, IRewardedToken {
  event Staked(address indexed from, address indexed to, uint256 amount, uint256 indexed referal);
  event Redeemed(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 underlyingAmount
  );
  event CooldownStarted(address indexed account, uint32 at);

  function stake(
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) external returns (uint256 stakeAmount);

  function redeem(address to, uint256 maxStakeAmount) external returns (uint256 stakeAmount);

  function redeemUnderlying(address to, uint256 maxUnderlyingAmount)
    external
    returns (uint256 underlyingAmount);

  function cooldown() external;

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
