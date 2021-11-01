// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/math/PercentageMath.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../interfaces/IRewardMinter.sol';
import './interfaces/IRewardPool.sol';
import './interfaces/IManagedRewardPool.sol';
import './interfaces/IRewardController.sol';
import './interfaces/IBoostExcessReceiver.sol';
import './interfaces/IBoostRate.sol';
import './interfaces/IRewardExplainer.sol';
import './autolock/AutolockBase.sol';
import './BaseRewardController.sol';

contract RewardBooster is IManagedRewardBooster, IRewardExplainer, BaseRewardController, AutolockBase {
  using PercentageMath for uint256;

  IManagedRewardPool private _boostPool;
  uint256 private _boostPoolMask;

  address private _boostExcessDelegate;
  uint16 private _minBoostPct;
  bool private _mintExcess;
  bool private _updateBoostPool;

  mapping(address => uint256) private _boostRewards;

  struct WorkReward {
    // saves some of storage cost
    uint112 claimableReward;
    uint112 boostLimit;
    uint32 claimedAt;
  }
  mapping(address => WorkReward) private _workRewards;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    BaseRewardController(accessController, rewardMinter)
  {}

  function internalOnPoolRemoved(IManagedRewardPool pool) internal override {
    super.internalOnPoolRemoved(pool);
    if (_boostPool == pool) {
      _boostPool = IManagedRewardPool(address(0));
      _boostPoolMask = 0;
    }
  }

  function setBoostFactor(address pool, uint32 pctFactor) external override onlyConfigOrRateAdmin {
    require(pool != address(_boostPool), 'factor for the boost pool');
    internalSetPoolInfo(pool, pctFactor);
  }

  function getBoostFactor(address pool) public view returns (uint32 pctFactor) {
    return uint32(internalGetPoolInfo(pool));
  }

  function setUpdateBoostPoolRate(bool updateBoostPool) external override onlyConfigAdmin {
    _updateBoostPool = updateBoostPool;
  }

  function getMinBoost() external view override returns (uint16) {
    return _minBoostPct;
  }

  function setMinBoost(uint16 minBoostPct) external override onlyConfigOrRateAdmin {
    require(minBoostPct <= PercentageMath.ONE, 'min boost is too high');
    _minBoostPct = minBoostPct;
    emit MinBoostUpdated(minBoostPct);
  }

  function internalUpdateBaseline(uint256 baseline, uint256 baselineMask)
    internal
    override
    returns (uint256 totalRate, uint256)
  {
    if (_boostPoolMask == 0 || !_updateBoostPool) {
      return super.internalUpdateBaseline(baseline, baselineMask);
    }

    (totalRate, baselineMask) = super.internalUpdateBaseline(baseline, baselineMask & ~_boostPoolMask);
    if (totalRate < baseline) {
      IBoostRate(address(_boostPool)).setBoostRate(baseline - totalRate);
      totalRate = baseline;
    } else {
      IBoostRate(address(_boostPool)).setBoostRate(0);
    }

    return (totalRate, baselineMask);
  }

  uint256 private constant BOOST_POOL_MARK = 1 << 33;

  function setBoostPool(address pool) external override onlyConfigAdmin {
    if (address(_boostPool) == pool) {
      return;
    }
    if (address(_boostPool) != address(0)) {
      internalSetPoolInfo(address(_boostPool), 0);
    }

    if (pool == address(0)) {
      _boostPoolMask = 0;
    } else {
      internalSetPoolInfo(pool, BOOST_POOL_MARK); // it also checks for known pool
      _boostPoolMask = getPoolMask(pool);
      require(_boostPoolMask != 0);
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

  function internalClaimAndMintReward(address holder, uint256 allMask)
    internal
    override
    returns (uint256 claimableAmount, uint256)
  {
    WorkReward memory workReward = _workRewards[holder];
    claimableAmount = workReward.claimableReward;
    uint256 boostLimit = workReward.boostLimit;

    _workRewards[holder] = WorkReward(0, 0, uint32(block.timestamp));

    for ((uint8 i, uint256 mask) = (0, 1); mask <= allMask; (i, mask) = (i + 1, mask << 1)) {
      if (mask & allMask == 0) {
        if (mask == 0) break;
        continue;
      }

      IManagedRewardPool pool = getPool(i);
      (uint256 amount_, , bool keepPull) = pool.claimRewardFor(holder);
      if (!keepPull) {
        internalUnsetPull(holder, mask);
      }

      if (amount_ == 0) {
        continue;
      }

      claimableAmount += amount_;
      boostLimit += amount_.percentMul(getBoostFactor(address(pool)));
    }

    uint256 boostAmount = _boostRewards[holder];
    if (boostAmount > 0) {
      delete (_boostRewards[holder]);
    }

    uint32 boostSince;
    if (_boostPool != IManagedRewardPool(address(0))) {
      if (_mintExcess || _boostExcessDelegate != address(_boostPool)) {
        uint256 boost_;
        (boost_, boostSince, ) = _boostPool.claimRewardFor(holder);
        boostAmount += boost_;
        boostLimit += PercentageMath.percentMul(boostAmount, _minBoostPct);
      } else {
        (boostAmount, boostSince, , boostLimit) = _boostPool.claimRewardWithLimitFor(
          holder,
          boostAmount,
          boostLimit,
          _minBoostPct
        );
      }
    }

    if (boostAmount <= boostLimit) {
      claimableAmount += boostAmount;
    } else {
      claimableAmount += boostLimit;
      // boostSince is not exactly correct for the whole boostAmount, but it is ok here
      internalStoreBoostExcess(boostAmount - boostLimit, boostSince);
    }

    return (claimableAmount, 0);
  }

  function internalCalcClaimableReward(
    address holder,
    uint256 mask,
    uint32 at
  ) internal view override returns (uint256 claimableAmount, uint256 delayedAmount) {
    WorkReward memory workReward = _workRewards[holder];
    claimableAmount = workReward.claimableReward;
    uint256 boostLimit = workReward.boostLimit;

    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      IManagedRewardPool pool = getPool(i);
      (uint256 amount_, uint256 extra_, ) = pool.calcRewardFor(holder, at);
      delayedAmount += extra_;
      if (amount_ == 0) {
        continue;
      }

      claimableAmount += amount_;
      boostLimit += amount_.percentMul(getBoostFactor(address(pool)));
    }

    uint256 boostAmount = _boostRewards[holder];

    if (_boostPool != IManagedRewardPool(address(0))) {
      (uint256 boost_, uint256 extra_, ) = _boostPool.calcRewardFor(holder, at);
      delayedAmount += extra_;
      boostAmount += boost_;
    }

    boostLimit += PercentageMath.percentMul(boostAmount, _minBoostPct);

    if (boostAmount <= boostLimit) {
      claimableAmount += boostAmount;
    } else {
      claimableAmount += boostLimit;
    }

    return (claimableAmount, delayedAmount);
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint256 poolInfo,
    uint32
  ) internal override {
    if (allocated == 0) {
      return;
    }

    if (poolInfo == BOOST_POOL_MARK) {
      _boostRewards[holder] += allocated;
      return;
    }

    WorkReward memory workReward = _workRewards[holder];
    if (workReward.claimedAt == 0) {
      workReward.claimedAt = uint32(block.timestamp);
    }

    uint256 v = workReward.claimableReward + allocated;
    require(v <= type(uint112).max);
    workReward.claimableReward = uint112(v);

    if (poolInfo != 0) {
      unchecked {
        v = workReward.boostLimit + allocated.percentMul(uint32(poolInfo));
      }
      if (v < type(uint112).max) {
        workReward.boostLimit = uint112(v);
      } else {
        workReward.boostLimit = type(uint112).max;
      }
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

  function disableAutolock() external onlyConfigAdmin {
    internalDisableAutolock();
  }

  function enableAutolockAndSetDefault(
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
      amount -= lockAmount;
      internalMint(lockReceiver, lockAmount, true);
    }
    if (amount > 0) {
      internalMint(mintTo, amount, false);
    }
    return lockAmount;
  }

  function claimableMask(address holder, uint256 includeMask) internal view override returns (uint256) {
    return super.claimableMask(holder, includeMask) & ~_boostPoolMask;
  }

  function explainReward(address holder, uint32 at) external view override returns (RewardExplained memory) {
    require(at >= uint32(block.timestamp));
    return internalExplainReward(holder, super.claimableMask(holder, 0), at);
  }

  function internalExplainReward(
    address holder,
    uint256 mask,
    uint32 at
  ) private view returns (RewardExplained memory r) {
    WorkReward memory workReward = _workRewards[holder];
    (r.amountClaimable, r.boostLimit, r.latestClaimAt) = (
      workReward.claimableReward,
      workReward.boostLimit,
      workReward.claimedAt
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
      uint256 extra_;
      (amount_, extra_, r.allocations[n].since) = pool.calcRewardFor(holder, at);
      r.allocations[n].extra = extra_;
      r.amountExtra += extra_;

      r.allocations[n].pool = address(pool);
      r.allocations[n].amount = amount_;

      if (pool == _boostPool) {
        r.allocations[n].rewardType = RewardType.BoostReward;
        r.allocations[n].factor = _minBoostPct;
        r.maxBoost = _boostRewards[holder] + amount_;
      } else {
        r.allocations[n].rewardType = RewardType.WorkReward;
        r.allocations[n].factor = getBoostFactor(address(pool));

        if (amount_ > 0) {
          r.amountClaimable += amount_;
          r.boostLimit += amount_.percentMul(r.allocations[n].factor);
        }
      }

      n++;
    }

    r.boostLimit += PercentageMath.percentMul(r.maxBoost, _minBoostPct);

    if (r.maxBoost <= r.boostLimit) {
      r.amountClaimable += r.maxBoost;
    } else {
      r.amountClaimable += r.boostLimit;
    }

    return r;
  }

  function internalSetPull(
    address holder,
    uint256 mask,
    AllocationMode mode
  ) internal override {
    super.internalSetPull(holder, mask, mode);
    if (mode == AllocationMode.SetPullSpecial) {
      super.internalCancelAutolock(holder);
    }
    if (_workRewards[holder].claimedAt == 0) {
      _workRewards[holder].claimedAt = uint32(block.timestamp);
    }
  }
}
