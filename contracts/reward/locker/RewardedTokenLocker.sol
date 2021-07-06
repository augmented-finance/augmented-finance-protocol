// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {BaseTokenLocker} from './BaseTokenLocker.sol';
import {ForwardedRewardPool} from '../pools/ForwardedRewardPool.sol';
import {CalcLinearWeightedReward} from '../calcs/CalcLinearWeightedReward.sol';
import {AllocationMode} from '../interfaces/IRewardController.sol';
import {IForwardingRewardPool} from '../interfaces/IForwardingRewardPool.sol';
import {IBoostExcessReceiver} from '../interfaces/IBoostExcessReceiver.sol';
import '../interfaces/IAutolocker.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

contract RewardedTokenLocker is
  BaseTokenLocker,
  ForwardedRewardPool,
  CalcLinearWeightedReward,
  IBoostExcessReceiver,
  IAutolocker
{
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  mapping(uint32 => uint256) private _accumHistory;

  constructor(
    IMarketAccessController accessCtl,
    address underlying,
    uint32 pointPeriod,
    uint32 maxValuePeriod,
    uint256 maxTotalSupply
  )
    public
    BaseTokenLocker(accessCtl, underlying, pointPeriod, maxValuePeriod)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function setForwardingRewardPool(IForwardingRewardPool forwarder) public onlyRewardAdmin {
    internalSetForwarder(forwarder);
  }

  function pushStakeBalance(address holder, uint32 at) internal virtual override {
    (uint256 amount, uint32 since) = doGetRewardAt(holder, at);
    if (amount > 0) {
      super.internalAllocateReward(holder, amount, since, AllocationMode.Push);
    }
  }

  function unsetStakeBalance(address holder) internal virtual override {
    super.internalRemoveReward(holder);
  }

  function setStakeBalance(address holder, uint224 stakeAmount) internal virtual override {
    (uint32 since, AllocationMode mode) =
      doOverrideReward(
        holder,
        0, /* doesn't matter */
        stakeAmount
      );
    super.internalAllocateReward(holder, 0, since, mode);
  }

  function getStakeBalance(address holder) internal view override returns (uint224) {
    return getRewardEntry(holder).rewardBase;
  }

  function balanceOf(address account) public view virtual override returns (uint256 stakeAmount) {
    (, uint32 expiry) = expiryOf(account);
    if (getCurrentTick() >= expiry) {
      return 0;
    }
    return getStakeBalance(account);
  }

  function calcReward(address holder)
    external
    view
    virtual
    override
    returns (uint256 amount, uint32 since)
  {
    (, uint32 expiry) = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0);
    }
    uint32 current = getCurrentTick();
    if (current > expiry) {
      current = expiry;
    }
    return super.doCalcRewardAt(holder, current);
  }

  function internalClaimReward(address holder, uint256 limit)
    internal
    virtual
    override
    returns (uint256 amount, uint32 since)
  {
    internalUpdate(true, 0);

    (, uint32 expiry) = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0);
    }
    uint32 current = getCurrentTick();
    if (current < expiry) {
      (amount, since) = super.doGetRewardAt(holder, current);
    } else {
      (amount, since) = super.doGetRewardAt(holder, expiry);
      super.internalRemoveReward(holder);
    }

    if (amount > limit) {
      internalAddExcess(amount - limit, since);
      return (limit, since);
    }
    return (amount, since);
  }

  function getRewardRate() external view override returns (uint256) {
    return super.getLinearRate().sub(internalGetExtraRate());
  }

  function internalSetRewardRate(uint256 rate) internal override {
    internalUpdate(false, 0);
    super.setLinearRate(rate.add(internalGetExtraRate()));
  }

  function internalExtraRateUpdated(
    uint256 rateBefore,
    uint256 rateAfter,
    uint32 at
  ) internal override {
    console.log('internalExtraRateUpdated', rateBefore, rateAfter, at);

    if (rateBefore > rateAfter) {
      rateAfter = super.getLinearRate().sub(rateBefore.sub(rateAfter));
    } else if (rateBefore < rateAfter) {
      rateAfter = super.getLinearRate().add(rateAfter.sub(rateBefore));
    } else {
      return;
    }

    if (at == 0) {
      super.setLinearRateAt(rateAfter, getCurrentTick());
      return;
    }

    super.setLinearRateAt(rateAfter, at);
    _accumHistory[at] = super.internalGetLastAccumRate() + 1;
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalUpdateTotal(
    uint256,
    uint256 totalAfter,
    uint32 at
  ) internal override {
    if (at == 0) {
      super.doUpdateTotalSupplyAt(totalAfter, getCurrentTick());
      return;
    }

    super.doUpdateTotalSupplyAt(totalAfter, at);
    _accumHistory[at] = super.internalGetLastAccumRate() + 1;
  }

  function receiveBoostExcess(uint256 amount, uint32 since) external override onlyForwarder {
    // TODO amount scaling
    internalUpdate(false, 0);
    internalAddExcess(amount, since);
  }

  function internalCalcRateAndReward(
    RewardEntry memory entry,
    uint256 lastAccumRate,
    uint32 currentTick
  )
    internal
    view
    virtual
    override
    returns (
      uint256 adjRate,
      uint256 allocated,
      uint32 since
    )
  {
    if (!isCompletedPast(currentTick)) {
      return super.internalCalcRateAndReward(entry, lastAccumRate, currentTick);
    }
    adjRate = _accumHistory[currentTick];
    require(adjRate > 0, 'unknown history point');
    adjRate--;

    if (adjRate == lastAccumRate || entry.rewardBase == 0) {
      return (adjRate, 0, entry.lastUpdate);
    }

    uint256 v = mulDiv(entry.rewardBase, adjRate.sub(lastAccumRate), totalSupplyMax());
    return (adjRate, v.div(WadRayMath.RAY), entry.lastUpdate);
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
    onlyForwarder
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
