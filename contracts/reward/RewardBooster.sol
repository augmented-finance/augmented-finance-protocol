// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BaseRewardController} from './BaseRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';
import {IRewardPool} from './interfaces/IRewardPool.sol';
import {IManagedRewardPool} from './interfaces/IManagedRewardPool.sol';
import {IBoostExcesser} from './interfaces/IBoostExcesser.sol';

import 'hardhat/console.sol';

enum BoostPoolRateUpdateMode {DefaultUpdateMode, BaselineLeftoverMode}

contract RewardBooster is BaseRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  mapping(address => uint256) private _boostFactor;
  IManagedRewardPool private _boostPool;
  uint256 private _boostPoolMask;

  address private _boostExcessDelegate;
  bool private _mintExcess;
  BoostPoolRateUpdateMode private _boostRateMode;

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

  function setBoostFactor(address pool, uint32 pctFactor) external {
    require(
      isConfigurator(msg.sender) || isRateController(msg.sender),
      'only owner or rate controller are allowed'
    );
    require(getPoolMask(pool) != 0, 'unknown pool');
    require(pool != address(_boostPool), 'factor for the boost pool');
    _boostFactor[pool] = pctFactor;
  }

  function getBoostFactor(address pool) external view returns (uint32 pctFactor) {
    return uint32(_boostFactor[pool]);
  }

  function setBoostPoolRateUpdateMode(BoostPoolRateUpdateMode mode) external onlyOwner {
    _boostRateMode = mode;
  }

  function internalUpdateBaseline(uint256 baseline, uint256 baselineMask)
    internal
    override
    returns (uint256 totalRate, uint256)
  {
    if (_boostPoolMask == 0 || _boostRateMode == BoostPoolRateUpdateMode.DefaultUpdateMode) {
      return super.internalUpdateBaseline(baseline, baselineMask);
    }

    (totalRate, baselineMask) = super.internalUpdateBaseline(
      baseline,
      baselineMask & ~_boostPoolMask
    );
    if (totalRate < baseline) {
      _boostPool.setRate(baseline - totalRate);
      totalRate = baseline;
    } else {
      _boostPool.setRate(0);
    }

    return (totalRate, baselineMask);
  }

  function setBoostPool(address pool) external onlyOwner {
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

  function getBoostPool() external view returns (address) {
    return address(_boostPool);
  }

  function setBoostExcessTarget(address target, bool mintExcess) external onlyOwner {
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
    returns (uint256 claimableAmount)
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
      (uint256 amount_, ) = pool.claimRewardFor(holder);
      if (amount_ == 0) {
        continue;
      }

      claimableAmount = claimableAmount.add(amount_);
      boostLimit = boostLimit.add(amount_.percentMul(_boostFactor[address(pool)]));
    }

    uint256 boost = _boostRewards[holder];
    if (boost > 0) {
      delete (_boostRewards[holder]);
    }

    if (_boostPool != IManagedRewardPool(0)) {
      (uint256 boost_, ) = _boostPool.claimRewardFor(holder);
      boost = boost.add(boost_);
    }

    // console.log('internalClaimAndMintReward', claimableAmount, boostLimit, boost);

    if (boost <= boostLimit) {
      claimableAmount = claimableAmount.add(boost);
    } else {
      claimableAmount = claimableAmount.add(boostLimit);
      internalStoreBoostExcess(boost - boostLimit);
    }

    return claimableAmount;
  }

  function internalCalcClaimableReward(address holder, uint256 mask)
    internal
    view
    override
    returns (uint256 claimableAmount, uint256)
  {
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
      (uint256 amount_, ) = pool.calcRewardFor(holder);
      if (amount_ == 0) {
        continue;
      }

      claimableAmount = claimableAmount.add(amount_);
      boostLimit = boostLimit.add(amount_.percentMul(_boostFactor[address(pool)]));
    }

    uint256 boost = _boostRewards[holder];

    if (_boostPool != IManagedRewardPool(0)) {
      (uint256 boost_, ) = _boostPool.calcRewardFor(holder);
      boost = boost.add(boost_);
    }

    if (boost <= boostLimit) {
      claimableAmount = claimableAmount.add(boost);
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

    uint256 factor = _boostFactor[pool];
    if (factor != 0) {
      v = uint256(workReward.boostLimit).add(allocated.mul(factor));
      require(v <= type(uint128).max);
      workReward.boostLimit = uint128(v);
    }

    _workRewards[holder] = workReward;
  }

  function internalStoreBoostExcess(uint256 boostExcess) private {
    if (_boostExcessDelegate == address(0)) {
      return;
    }

    if (_mintExcess) {
      internalMint(_boostExcessDelegate, boostExcess, true);
      return;
    }

    IBoostExcesser(_boostExcessDelegate).storeBoostExcess(boostExcess);
  }
}
