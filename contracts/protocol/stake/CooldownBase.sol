// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import './interfaces/IStakeToken.sol';
import './interfaces/IManagedStakeToken.sol';

abstract contract CooldownBase is IStakeToken, IManagedStakeToken {
  uint32 internal constant MIN_UNSTAKE_PERIOD = 2 minutes;

  uint32 private _cooldownPeriod;
  uint32 private _unstakePeriod = MIN_UNSTAKE_PERIOD;

  function _ensureCooldown(address user) internal view returns (uint32 cooldownStartedAt) {
    cooldownStartedAt = uint32(getCooldown(user));
    require(
      cooldownStartedAt != 0 && block.timestamp > cooldownStartedAt + _cooldownPeriod,
      Errors.STK_INSUFFICIENT_COOLDOWN
    );
    require(
      block.timestamp <= (cooldownStartedAt + _cooldownPeriod) + _unstakePeriod,
      Errors.STK_UNSTAKE_WINDOW_FINISHED
    );
  }

  function getCooldown(address holder) public view virtual override returns (uint32);

  function internalSetCooldown(uint32 cooldownPeriod, uint32 unstakePeriod) internal {
    require(cooldownPeriod <= 52 weeks, Errors.STK_WRONG_COOLDOWN_OR_UNSTAKE);
    require(unstakePeriod >= MIN_UNSTAKE_PERIOD && unstakePeriod <= 52 weeks, Errors.STK_WRONG_COOLDOWN_OR_UNSTAKE);
    _cooldownPeriod = cooldownPeriod;
    _unstakePeriod = unstakePeriod;
    emit CooldownUpdated(cooldownPeriod, unstakePeriod);
  }

  /**
   * @dev Calculates the how is gonna be a new cooldown time depending on the sender/receiver situation
   *  - If the time of the sender is better or the time of the recipient is 0, we take the one of the recipient
   *  - Weighted average of from/to cooldown time if:
   *    # The sender doesn't have the cooldown activated (time 0).
   *    # The sender time is passed
   *    # The sender has a worse time
   *  - If the receiver's cooldown time passed (too old), the next is 0
   * @param fromCooldownStart Cooldown time of the sender
   * @param amountToReceive Amount
   * @param toBalance Current balance of the receiver
   * @param toCooldownStart Cooldown of the recipient
   * @return The new cooldown time of the recipient
   **/
  function getNextCooldown(
    uint32 fromCooldownStart,
    uint256 amountToReceive,
    uint256 toBalance,
    uint32 toCooldownStart
  ) internal view returns (uint32) {
    if (toCooldownStart == 0) {
      return 0;
    }

    uint256 minimalValidCooldown = (block.timestamp - _cooldownPeriod) - _unstakePeriod;
    if (minimalValidCooldown > toCooldownStart) {
      return 0;
    }
    if (minimalValidCooldown > fromCooldownStart) {
      fromCooldownStart = uint32(block.timestamp);
    }
    if (fromCooldownStart < toCooldownStart) {
      return toCooldownStart;
    }

    return uint32((amountToReceive * fromCooldownStart + toBalance * toCooldownStart) / (amountToReceive + toBalance));
  }

  // solhint-disable-next-line func-name-mixedcase
  function COOLDOWN_PERIOD() public view returns (uint256) {
    return _cooldownPeriod;
  }

  /// @notice Seconds available to redeem once the cooldown period is fullfilled
  // solhint-disable-next-line func-name-mixedcase
  function UNSTAKE_PERIOD() public view returns (uint256) {
    return _unstakePeriod;
  }
}
