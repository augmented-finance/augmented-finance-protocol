// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IBoostRate.sol';
import '../interfaces/IBoostExcessReceiver.sol';
import '../interfaces/IRewardController.sol';
import '../interfaces/IAutolocker.sol';
import '../pools/ControlledRewardPool.sol';
import '../calcs/CalcCheckpointWeightedReward.sol';
import './BaseTokenLocker.sol';

contract RewardedTokenLocker is
  BaseTokenLocker,
  ControlledRewardPool,
  CalcCheckpointWeightedReward,
  IBoostExcessReceiver,
  IBoostRate,
  IAutolocker
{
  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address underlying
  )
    CalcCheckpointWeightedReward()
    BaseTokenLocker(underlying)
    ControlledRewardPool(controller, initialRate, baselinePercentage)
  {}

  function redeem(address to) public override notPaused returns (uint256 underlyingAmount) {
    return super.redeem(to);
  }

  function isRedeemable() external view returns (bool) {
    return !isPaused();
  }

  function addRewardProvider(address, address) external view override onlyConfigAdmin {
    revert('UNSUPPORTED');
  }

  function removeRewardProvider(address) external override onlyConfigAdmin {}

  function internalSyncRate(uint32 at) internal override {
    doSyncRateAt(at);
  }

  function internalCheckpoint(uint32 at) internal override {
    doCheckpoint(at);
  }

  function setStakeBalance(address holder, uint224 stakeAmount) internal virtual override {
    (uint256 amount, uint32 since, AllocationMode mode) = doUpdateRewardBalance(holder, stakeAmount);
    internalAllocateReward(holder, amount, since, mode);
  }

  function unsetStakeBalance(address holder, uint32 at) internal virtual override {
    (uint256 amount, uint32 since, ) = doGetRewardAt(holder, at);
    doRemoveRewardBalance(holder);
    if (amount == 0) {
      return;
    }
    internalAllocateReward(holder, amount, since, AllocationMode.Push);
  }

  function getStakeBalance(address holder) internal view override returns (uint224) {
    return getRewardEntry(holder).rewardBase;
  }

  function isHistory(uint32 at) internal view override returns (bool) {
    return isCompletedPast(at);
  }

  function internalExtraRate() internal view override returns (uint256) {
    return getExtraRate();
  }

  function internalTotalSupply() internal view override returns (uint256) {
    return getStakedTotal();
  }

  function balanceOf(address account) public view virtual override returns (uint256 stakeAmount) {
    (, uint32 expiry) = expiryOf(account);
    if (getCurrentTick() >= expiry) {
      return 0;
    }
    return getStakeBalance(account);
  }

  function internalCalcReward(address holder, uint32 current)
    internal
    view
    virtual
    override
    returns (uint256 amount, uint32 since)
  {
    (, uint32 expiry) = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0);
    }
    if (current > expiry) {
      current = expiry;
    }
    return doCalcRewardAt(holder, current);
  }

  function internalGetReward(address holder)
    internal
    virtual
    override
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull
    )
  {
    (amount, since, keepPull, ) = internalGetRewardWithLimit(holder, 0, type(uint256).max, 0);
  }

  function internalGetRewardWithLimit(
    address holder,
    uint256 baseAmount,
    uint256 limit,
    uint16 minBoostPct
  )
    internal
    virtual
    override
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull,
      uint256
    )
  {
    internalUpdate(true, 0);

    (, uint32 expiry) = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0, false, 0);
    }
    uint32 current = getCurrentTick();
    if (current < expiry) {
      (amount, since, keepPull) = doGetRewardAt(holder, current);
    } else {
      (amount, since, ) = doGetRewardAt(holder, expiry);
      doRemoveRewardBalance(holder);
      keepPull = false;
    }

    amount += baseAmount;
    if (amount <= limit) {
      return (amount, since, keepPull, limit);
    }

    if (minBoostPct > 0) {
      limit += PercentageMath.percentMul(amount, minBoostPct);
      if (amount <= limit) {
        return (amount, since, keepPull, limit);
      }
    }

    internalAddExcess(amount - limit, since);
    return (limit, since, keepPull, limit);
  }

  function internalGetRate() internal view override returns (uint256) {
    return getLinearRate();
  }

  function internalSetRate(uint256 rate) internal override {
    internalUpdate(false, 0);
    setLinearRate(rate);
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function setBoostRate(uint256 rate) external override onlyController {
    _setRate(rate);
  }

  function receiveBoostExcess(uint256 amount, uint32 since) external override onlyController {
    internalUpdate(false, 0);
    internalAddExcess(amount, since);
  }

  function applyAutolock(
    address account,
    uint256 amount,
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  )
    external
    override
    onlyController
    returns (
      address, /* receiver */
      uint256, /* lockAmount */
      bool stop
    )
  {
    uint256 recoverableError;
    if (mode == AutolockMode.Prolongate) {
      // full amount is locked
    } else if (mode == AutolockMode.AccumulateTill) {
      // full amount is locked
      if (block.timestamp >= param) {
        stop = true;
        amount = 0;
      }
    } else if (mode == AutolockMode.AccumulateUnderlying) {
      (amount, stop) = calcAutolockUnderlying(amount, balanceOfUnderlying(account), param);
    } else if (mode == AutolockMode.KeepUpBalance) {
      if (lockDuration == 0) {
        // shouldn't happen
        stop = true;
        amount = 0;
      } else {
        // it never stops unless the lock expires
        amount = calcAutolockKeepUp(amount, balanceOf(account), param, lockDuration);
      }
    } else {
      return (address(0), 0, false);
    }

    if (amount == 0) {
      return (address(0), 0, stop);
    }

    // NB! the tokens are NOT received here and must be minted to this locker directly
    (, recoverableError) = internalLock(address(this), account, amount, lockDuration, 0, false);

    if (recoverableError != 0) {
      emit RewardAutolockFailed(account, mode, recoverableError);
      return (address(0), 0, true);
    }

    return (address(this), amount, stop);
  }

  function calcAutolockUnderlying(
    uint256 amount,
    uint256 balance,
    uint256 limit
  ) private pure returns (uint256, bool) {
    if (balance >= limit) {
      return (0, true);
    }
    limit -= balance;

    if (amount > limit) {
      return (limit, true);
    }
    return (amount, amount == limit);
  }

  function calcAutolockKeepUp(
    uint256 amount,
    uint256 balance,
    uint256 limit,
    uint32 lockDuration
  ) private view returns (uint256) {
    this;
    if (balance >= limit) {
      return 0;
    }

    limit = convertLockedToUnderlying(limit - balance, lockDuration);

    if (amount > limit) {
      return limit;
    }
    return amount;
  }
}
