// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BaseRewardController} from './BaseRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';
import {IRewardPool} from './interfaces/IRewardPool.sol';
import {IManagedRewardPool} from './interfaces/IManagedRewardPool.sol';
import {IManagedRewardBooster} from './interfaces/IRewardController.sol';
import {IBoostExcessReceiver} from './interfaces/IBoostExcessReceiver.sol';
import {IBoostRate} from './interfaces/IBoostRate.sol';
import './interfaces/IRewardExplainer.sol';
import {AutolockBase} from './autolock/AutolockBase.sol';
import {AutolockMode} from './interfaces/IAutolocker.sol';

import 'hardhat/console.sol';

contract RewardBooster is
  IManagedRewardBooster,
  IRewardExplainer,
  BaseRewardController,
  AutolockBase
{
  using SafeMath for uint256;
  using PercentageMath for uint256;

  mapping(address => uint32) private _boostFactor;
  IManagedRewardPool private _boostPool;
  uint256 private _boostPoolMask;

  address private _boostExcessDelegate;
  bool private _mintExcess;
  bool private _updateBoostPool;

  mapping(address => uint256) private _boostRewards;

  struct WorkReward {
    // saves some of storage cost
    uint128 claimableReward;
    uint128 boostLimit;
  }
  mapping(address => WorkReward) private _workRewards;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    public
    BaseRewardController(accessController, rewardMinter)
  {}

  function internalOnPoolRemoved(IManagedRewardPool pool) internal override {
    super.internalOnPoolRemoved(pool);
    if (_boostPool == pool) {
      _boostPool = IManagedRewardPool(0);
      _boostPoolMask = 0;
    } else {
      delete (_boostFactor[address(pool)]);
    }
  }

  function setBoostFactor(address pool, uint32 pctFactor) external override onlyConfigOrRateAdmin {
    require(getPoolMask(pool) != 0, 'unknown pool');
    require(pool != address(_boostPool), 'factor for the boost pool');
    _boostFactor[pool] = pctFactor;
  }

  function getBoostFactor(address pool) external view returns (uint32 pctFactor) {
    return uint32(_boostFactor[pool]);
  }

  function setUpdateBoostPoolRate(bool updateBoostPool) external override onlyConfigAdmin {
    _updateBoostPool = updateBoostPool;
  }

  function internalUpdateBaseline(uint256 baseline, uint256 baselineMask)
    internal
    override
    returns (uint256 totalRate, uint256)
  {
    if (_boostPoolMask == 0 || !_updateBoostPool) {
      return super.internalUpdateBaseline(baseline, baselineMask);
    }

    (totalRate, baselineMask) = super.internalUpdateBaseline(
      baseline,
      baselineMask & ~_boostPoolMask
    );
    if (totalRate < baseline) {
      IBoostRate(address(_boostPool)).setBoostRate(baseline - totalRate);
      totalRate = baseline;
    } else {
      IBoostRate(address(_boostPool)).setBoostRate(0);
    }

    return (totalRate, baselineMask);
  }

  function setBoostPool(address pool) external override onlyConfigAdmin {
    if (pool == address(0)) {
      _boostPoolMask = 0;
    } else {
      uint256 mask = getPoolMask(pool);
      require(mask != 0, 'unknown pool');
      _boostPoolMask = mask;

      delete (_boostFactor[pool]);
    }
    _boostPool = IManagedRewardPool(pool);
  }

  function getBoostPool() external view override returns (address pool, uint256 mask) {
    return (address(_boostPool), _boostPoolMask);
  }

  function setBoostExcessTarget(address target, bool mintExcess) external override onlyConfigAdmin {
    _boostExcessDelegate = target;
    _mintExcess = mintExcess && (target != address(0));
  }

  function getBoostExcessTarget() external view returns (address target, bool mintExcess) {
    return (_boostExcessDelegate, _mintExcess);
  }

  function getClaimMask(address holder, uint256 mask) internal view override returns (uint256) {
    mask = super.getClaimMask(holder, mask);
    mask &= ~_boostPoolMask;
    return mask;
  }

  function internalClaimAndMintReward(address holder, uint256 mask)
    internal
    override
    returns (uint256 claimableAmount, uint256)
  {
    uint256 boostLimit;
    (claimableAmount, boostLimit) = (
      _workRewards[holder].claimableReward,
      _workRewards[holder].boostLimit
    );

    if (boostLimit > 0 || claimableAmount > 0) {
      delete (_workRewards[holder]);
    }

    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      IManagedRewardPool pool = getPool(i);
      (uint256 amount_, ) = pool.claimRewardFor(holder, type(uint256).max);
      if (amount_ == 0) {
        continue;
      }

      claimableAmount = claimableAmount.add(amount_);
      boostLimit = boostLimit.add(amount_.percentMul(_boostFactor[address(pool)]));
    }

    uint256 boostAmount = _boostRewards[holder];
    if (boostAmount > 0) {
      delete (_boostRewards[holder]);
    }

    uint32 boostSince;
    if (_boostPool != IManagedRewardPool(0)) {
      uint256 boost_;

      if (_mintExcess || _boostExcessDelegate != address(_boostPool)) {
        (boost_, boostSince) = _boostPool.claimRewardFor(holder, type(uint256).max);
      } else {
        uint256 boostLimit_;
        if (boostLimit > boostAmount) {
          boostLimit_ = boostLimit - boostAmount;
        }
        (boost_, boostSince) = _boostPool.claimRewardFor(holder, boostLimit_);
      }

      boostAmount = boostAmount.add(boost_);
    }

    if (boostAmount <= boostLimit) {
      claimableAmount = claimableAmount.add(boostAmount);
    } else {
      claimableAmount = claimableAmount.add(boostLimit);
      internalStoreBoostExcess(boostAmount - boostLimit, boostSince);
    }

    return (claimableAmount, 0);
  }

  function internalCalcClaimableReward(
    address holder,
    uint256 mask,
    uint32 at
  ) internal view override returns (uint256 claimableAmount, uint256) {
    uint256 boostLimit;
    (claimableAmount, boostLimit) = (
      _workRewards[holder].claimableReward,
      _workRewards[holder].boostLimit
    );

    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      IManagedRewardPool pool = getPool(i);
      (uint256 amount_, ) = pool.calcRewardFor(holder, at);
      if (amount_ == 0) {
        continue;
      }

      claimableAmount = claimableAmount.add(amount_);
      boostLimit = boostLimit.add(amount_.percentMul(_boostFactor[address(pool)]));
    }

    uint256 boostAmount = _boostRewards[holder];

    if (_boostPool != IManagedRewardPool(0)) {
      (uint256 boost_, ) = _boostPool.calcRewardFor(holder, at);
      boostAmount = boostAmount.add(boost_);
    }

    if (boostAmount <= boostLimit) {
      claimableAmount = claimableAmount.add(boostAmount);
    } else {
      claimableAmount = claimableAmount.add(boostLimit);
    }

    return (claimableAmount, 0);
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    address pool,
    uint32
  ) internal override {
    if (address(_boostPool) == pool) {
      _boostRewards[holder] = _boostRewards[holder].add(allocated);
      return;
    }

    WorkReward memory workReward = _workRewards[holder];

    uint256 v = uint256(workReward.claimableReward).add(allocated);
    require(v <= type(uint128).max);
    workReward.claimableReward = uint128(v);

    uint32 factor = _boostFactor[pool];
    if (factor != 0) {
      v = uint256(workReward.boostLimit).add(allocated.percentMul(factor));
      require(v <= type(uint128).max);
      workReward.boostLimit = uint128(v);
    }

    _workRewards[holder] = workReward;
  }

  function internalStoreBoostExcess(uint256 boostExcess, uint32 since) private {
    if (_boostExcessDelegate == address(0)) {
      return;
    }

    if (_mintExcess) {
      internalMint(_boostExcessDelegate, boostExcess, true);
      return;
    }

    IBoostExcessReceiver(_boostExcessDelegate).receiveBoostExcess(boostExcess, since);
  }

  function disableAutolocks() external onlyConfigAdmin {
    internalDisableAutolocks();
  }

  function setDefaultAutolock(
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  ) external onlyConfigAdmin {
    internalSetDefaultAutolock(mode, lockDuration, param);
  }

  function internalClaimed(
    address holder,
    address mintTo,
    uint256 amount
  ) internal override returns (uint256 lockAmount) {
    address lockReceiver;
    (lockAmount, lockReceiver) = internalApplyAutolock(address(_boostPool), holder, amount);
    if (lockAmount > 0) {
      amount = amount.sub(lockAmount);
      internalMint(lockReceiver, lockAmount, true);
    }
    if (amount > 0) {
      internalMint(mintTo, amount, false);
    }
    return lockAmount;
  }

  function explainReward(address holder, uint32 at)
    external
    view
    override
    returns (RewardExplained memory)
  {
    require(at >= uint32(block.timestamp));
    return internalExplainReward(holder, ~uint256(0), at);
  }

  function internalExplainReward(
    address holder,
    uint256 mask,
    uint32 at
  ) internal view returns (RewardExplained memory r) {
    mask = getClaimMask(holder, mask) | _boostPoolMask;

    (r.amountClaimable, r.boostLimit) = (
      _workRewards[holder].claimableReward,
      _workRewards[holder].boostLimit
    );

    uint256 n;
    for (uint256 mask_ = mask; mask_ != 0; mask_ >>= 1) {
      if (mask_ & 1 != 0) {
        n++;
      }
    }
    r.allocations = new RewardExplainEntry[](n);

    n = 0;
    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      IManagedRewardPool pool = getPool(i);
      uint256 amount_;
      (amount_, r.allocations[n].since) = pool.calcRewardFor(holder, at);

      r.allocations[n].pool = address(pool);
      r.allocations[n].amount = amount_;

      if (pool == _boostPool) {
        r.allocations[n].rewardType = RewardType.BoostReward;
        r.maxBoost = _boostRewards[holder] + amount_;
      } else {
        r.allocations[n].rewardType = RewardType.WorkReward;
        r.allocations[n].factor = _boostFactor[address(pool)];

        if (amount_ > 0) {
          r.amountClaimable = r.amountClaimable.add(amount_);
          r.boostLimit = r.boostLimit.add(amount_.percentMul(r.allocations[n].factor));
        }
      }

      n++;
    }

    if (r.maxBoost <= r.boostLimit) {
      r.amountClaimable = r.amountClaimable.add(r.maxBoost);
    } else {
      r.amountClaimable = r.amountClaimable.add(r.boostLimit);
    }

    return r;
  }
}
