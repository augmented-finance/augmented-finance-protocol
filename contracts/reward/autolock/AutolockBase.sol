// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/PercentageMath.sol';

import '../../access/interfaces/IMarketAccessController.sol';
import '../BaseRewardController.sol';
import '../../interfaces/IRewardMinter.sol';
import '../interfaces/IRewardPool.sol';
import '../interfaces/IManagedRewardPool.sol';
import '../interfaces/IRewardController.sol';
import '../interfaces/IBoostExcessReceiver.sol';
import '../interfaces/IBoostRate.sol';
import '../interfaces/IRewardExplainer.sol';

import '../interfaces/IAutolocker.sol';

abstract contract AutolockBase {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  struct AutolockEntry {
    uint224 param;
    AutolockMode mode;
    uint8 lockDuration;
  }

  mapping(address => AutolockEntry) private _autolocks;
  AutolockEntry private _defaultAutolock;

  function internalDisableAutolock() internal {
    _defaultAutolock = AutolockEntry(0, AutolockMode.Default, 0);
    emit RewardAutolockConfigured(address(this), AutolockMode.Default, 0, 0);
  }

  function isAutolockEnabled() public view returns (bool) {
    return _defaultAutolock.mode != AutolockMode.Default;
  }

  function internalSetDefaultAutolock(
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  ) internal {
    require(mode > AutolockMode.Default);

    _defaultAutolock = AutolockEntry(param, mode, fromDuration(lockDuration));
    emit RewardAutolockConfigured(address(this), mode, lockDuration, param);
  }

  function fromDuration(uint32 lockDuration) private pure returns (uint8) {
    require(lockDuration % 1 weeks == 0, 'duration must be in weeks');
    uint256 v = lockDuration / 1 weeks;
    require(v <= 4 * 52, 'duration must be less than 209 weeks');
    return uint8(v);
  }

  event RewardAutolockConfigured(
    address indexed account,
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  );

  function _setAutolock(
    address account,
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  ) private {
    _autolocks[account] = AutolockEntry(param, mode, fromDuration(lockDuration));
    emit RewardAutolockConfigured(account, mode, lockDuration, param);
  }

  function autolockProlongate(uint32 minLockDuration) external {
    _setAutolock(msg.sender, AutolockMode.Prolongate, minLockDuration, 0);
  }

  function autolockAccumulateUnderlying(uint256 maxAmount, uint32 lockDuration) external {
    require(maxAmount > 0, 'max amount is required');
    if (maxAmount > type(uint224).max) {
      maxAmount = type(uint224).max;
    }

    _setAutolock(msg.sender, AutolockMode.AccumulateUnderlying, lockDuration, uint224(maxAmount));
  }

  function autolockAccumulateTill(uint256 timestamp, uint32 lockDuration) external {
    require(timestamp > block.timestamp, 'future timestamp is required');
    if (timestamp > type(uint224).max) {
      timestamp = type(uint224).max;
    }
    _setAutolock(msg.sender, AutolockMode.AccumulateTill, lockDuration, uint224(timestamp));
  }

  function autolockKeepUpBalance(uint256 minAmount, uint32 lockDuration) external {
    require(minAmount > 0, 'min amount is required');
    require(lockDuration > 0, 'lock duration is required');

    if (minAmount > type(uint224).max) {
      minAmount = type(uint224).max;
    }
    _setAutolock(msg.sender, AutolockMode.KeepUpBalance, lockDuration, uint224(minAmount));
  }

  function autolockDefault() external {
    _setAutolock(msg.sender, AutolockMode.Default, 0, 0);
  }

  function autolockStop() external {
    _setAutolock(msg.sender, AutolockMode.Stop, 0, 0);
  }

  function autolockOf(address account)
    public
    view
    returns (
      AutolockMode mode,
      uint32 lockDuration,
      uint256 param
    )
  {
    AutolockEntry memory entry = _autolocks[account];
    if (entry.mode == AutolockMode.Default) {
      entry = _defaultAutolock;
    }
    return (entry.mode, entry.lockDuration * 1 weeks, entry.param);
  }

  function internalApplyAutolock(
    address autolocker,
    address holder,
    uint256 amount
  ) internal returns (uint256 lockAmount, address lockReceiver) {
    if (autolocker == address(0)) {
      return (0, address(0));
    }

    AutolockEntry memory entry = _autolocks[holder];
    if (entry.mode == AutolockMode.Stop || _defaultAutolock.mode == AutolockMode.Default) {
      return (0, address(0));
    }

    if (entry.mode == AutolockMode.Default) {
      entry = _defaultAutolock;
      if (entry.mode == AutolockMode.Stop) {
        return (0, address(0));
      }
    }

    bool stop;
    (lockReceiver, lockAmount, stop) = IAutolocker(autolocker).applyAutolock(
      holder,
      amount,
      entry.mode,
      entry.lockDuration * 1 weeks,
      entry.param
    );

    if (stop) {
      _setAutolock(holder, AutolockMode.Stop, 0, 0);
    }

    if (lockAmount > 0) {
      require(lockReceiver != address(0));
      return (lockAmount, lockReceiver);
    }
    return (0, address(0));
  }
}
