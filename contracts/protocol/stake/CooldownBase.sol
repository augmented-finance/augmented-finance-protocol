// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import './interfaces/IStakeToken.sol';
import './interfaces/IManagedStakeToken.sol';

abstract contract CooldownBase is IStakeToken, IManagedStakeToken {
  uint32 private _cooldownPeriod;
  uint32 private _unstakePeriod;

  uint32 internal constant MIN_UNSTAKE_PERIOD = 2 minutes;

  constructor() {
    _unstakePeriod = MIN_UNSTAKE_PERIOD;
  }

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
    require(cooldownPeriod <= 52 weeks, Errors.STK_EXCESSIVE_COOLDOWN_PERIOD);
    require(unstakePeriod >= MIN_UNSTAKE_PERIOD && unstakePeriod <= 52 weeks, Errors.STK_WRONG_UNSTAKE_PERIOD);
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
   * @param fromCooldownPeriod Cooldown time of the sender
   * @param amountToReceive Amount
   * @param toAddress Address of the recipient
   * @param toBalance Current balance of the receiver
   * @return The new cooldown time
   **/
  function getNextCooldown(
    uint32 fromCooldownPeriod,
    uint256 amountToReceive,
    address toAddress,
    uint256 toBalance
  ) internal view returns (uint32) {
    uint32 toCooldownPeriod = getCooldown(toAddress);
    if (toCooldownPeriod == 0) {
      return 0;
    }

    uint256 minimalValidCooldown = (block.timestamp - _cooldownPeriod) - _unstakePeriod;

    if (minimalValidCooldown > toCooldownPeriod) {
      toCooldownPeriod = 0;
    } else {
      if (minimalValidCooldown > fromCooldownPeriod) {
        fromCooldownPeriod = uint32(block.timestamp);
      }
      if (fromCooldownPeriod < toCooldownPeriod) {
        return toCooldownPeriod;
      }

      toCooldownPeriod = uint32(
        (amountToReceive * fromCooldownPeriod + toBalance * toCooldownPeriod) / (amountToReceive + toBalance)
      );
    }

    return toCooldownPeriod;
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
