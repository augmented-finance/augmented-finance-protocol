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

import {RewardedTokenLocker} from './RewardedTokenLocker.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

contract DecayingTokenLocker is RewardedTokenLocker {
  constructor(
    IMarketAccessController accessCtl,
    address underlying,
    uint32 pointPeriod,
    uint32 maxValuePeriod,
    uint256 maxTotalSupply
  )
    public
    RewardedTokenLocker(accessCtl, underlying, pointPeriod, maxValuePeriod, maxTotalSupply)
  {}

  function balanceOf(address account) external view virtual override returns (uint256) {
    (uint256 stakeAmount, uint32 startTS, uint32 endTS) = internalBalanceOf(account);
    if (stakeAmount == 0) {
      return 0;
    }

    uint256 balanceDecay =
      uint256(stakeAmount).mul(endTS - uint32(block.timestamp)).div(endTS - startTS);
    if (balanceDecay >= stakeAmount) {
      return 0;
    }
    return uint256(stakeAmount).sub(balanceDecay);
  }

  function calcReward(address holder)
    external
    view
    override
    returns (uint256 amount, uint32 since)
  {
    (, uint32 startTS, uint32 endTS) = internalBalanceOf(holder);
    if (endTS == 0) {
      return (0, 0);
    }

    uint32 current = getCurrentTick();
    if (current >= endTS) {
      current = endTS;
    }

    (amount, since) = super.doCalcRewardAt(holder, current);
    if (amount == 0) {
      return (0, 0);
    }

    amount = amount.rayMul(calcDecay(startTS, endTS, since, current));
    if (amount == 0) {
      return (0, 0);
    }

    return (amount, since);
  }

  function calcDecay(
    uint32 startTS,
    uint256 endTS,
    uint32 since,
    uint32 current
  ) private pure returns (uint256) {
    return WadRayMath.RAY.mul((endTS << 1) - since - current).div((endTS - startTS) << 1);
  }

  function internalClaimReward(address holder, uint256 limit)
    internal
    virtual
    override
    returns (uint256 amount, uint32 since)
  {
    internalUpdate(true);

    (, uint32 startTS, uint32 endTS) = internalBalanceOf(holder);
    if (endTS == 0) {
      return (0, 0);
    }

    uint32 current = getCurrentTick();
    if (current >= endTS) {
      current = endTS;
      (amount, since) = super.doGetRewardAt(holder, current);
      super.internalRemoveReward(holder);
    } else {
      (amount, since) = super.doGetRewardAt(holder, current);
    }

    if (amount == 0) {
      return (0, 0);
    }

    uint256 maxAmount = amount;
    amount = amount.rayMul(calcDecay(startTS, endTS, since, current));

    if (amount > limit) {
      amount = limit;
    }

    if (maxAmount > amount) {
      internalAddExcess(maxAmount - amount, since);
    }

    if (amount == 0) {
      return (0, 0);
    }

    return (amount, since);
  }
}
