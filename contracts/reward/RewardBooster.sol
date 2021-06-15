// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BaseRewardController} from './BaseRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';
import {IBoostExcesser} from './interfaces/IBoostExcesser.sol';

import 'hardhat/console.sol';

contract RewardBooster is BaseRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  mapping(address => uint256) private _boostFactor;
  IManagedRewardPool private _boostPool;
  uint256 private _boostPoolMask;

  address private _boostExcessDelegate;
  bool private _mintExcess;

  mapping(address => uint256) private _boostRewards;
  mapping(address => uint256) private _claimableRewards;

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
    uint256 boostLimit = 0;

    claimableAmount = _claimableRewards[holder];
    if (claimableAmount > 0) {
      delete (_claimableRewards[holder]);
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
    uint256 boostLimit = 0;

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
    } else {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
    }
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
