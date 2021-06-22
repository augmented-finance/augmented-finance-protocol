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

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

contract RewardedTokenLocker is BaseTokenLocker, ForwardedRewardPool, CalcLinearWeightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private _rate;
  uint32 private _lastRateUpdate;

  constructor(
    IMarketAccessController accessCtl,
    uint32 pointPeriod,
    uint32 maxValuePeriod,
    uint256 maxTotalSupply
  )
    public
    BaseTokenLocker(accessCtl, pointPeriod, maxValuePeriod)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function setForwardingRewardPool(IForwardingRewardPool forwarder) public onlyRewardAdmin {
    internalSetForwarder(forwarder);
  }

  function setStakeBalance(address holder, uint224 stakeAmount) internal override {
    (uint256 allocated, uint32 since, AllocationMode mode) = doUpdateReward(holder, 0, stakeAmount);
    super.internalAllocateReward(holder, allocated, since, mode);
  }

  function getStakeBalance(address holder)
    internal
    view
    override
    returns (uint224 stakeAmount, uint32 startTS)
  {
    RewardEntry memory entry = getRewardEntry(holder);
    return (entry.rewardBase, entry.lastUpdate);
  }

  function calcReward(address holder)
    external
    view
    override
    returns (uint256 amount, uint32 since)
  {
    uint32 expiry = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0);
    }
    uint32 current = getCurrentBlock();
    if (current > expiry) {
      current = expiry;
    }
    // TODO need to pre-calc total
    return super.doCalcRewardAt(holder, current);
  }

  function internalClaimReward(address holder)
    internal
    override
    returns (uint256 amount, uint32 since)
  {
    internalUpdate(false, true);

    uint32 expiry = expiryOf(holder);
    if (expiry == 0) {
      return (0, 0);
    }
    uint32 current = getCurrentBlock();
    if (current < expiry) {
      return super.doGetRewardAt(holder, current);
    }

    (amount, since) = super.doCalcRewardAt(holder, expiry);
    super.internalRemoveReward(holder);

    return (amount, since);
  }

  function getRewardRate() external view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRewardRate(uint256 rate) internal override {
    super.setLinearRate(rate);
  }

  function getCurrentBlock() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalUpdateTotal(
    uint256,
    uint256 totalAfter,
    uint32 at
  ) internal override {
    super.doUpdateTotalSupplyAt(totalAfter, at);
  }
}
