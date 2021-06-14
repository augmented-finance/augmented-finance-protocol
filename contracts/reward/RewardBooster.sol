// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BaseRewardController} from './BaseRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';

import 'hardhat/console.sol';

contract RewardBooster is BaseRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  mapping(address => uint256) private _boostFactor;
  IManagedRewardPool private _boostPool;

  mapping(address => uint256) private _boostRewards;
  mapping(address => uint256) private _claimableRewards;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    public
    BaseRewardController(accessController, rewardMinter)
  {}

  function setBoostFactor(address pool, uint32 pctFactor) external onlyOwner {}

  function setBoostPool(address pool) external onlyOwner {}

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
    uint32 sinceBlock
  ) internal override {}

  function internalStoreBoostExcess(uint256 boostExcess) private {}
}
