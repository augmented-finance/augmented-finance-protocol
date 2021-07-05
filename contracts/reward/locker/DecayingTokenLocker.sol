// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';

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

  function balanceOf(address account) public view virtual override returns (uint256) {
    (uint32 startTS, uint32 endTS) = expiryOf(account);
    uint32 current = getCurrentTick();
    if (current >= endTS) {
      return 0;
    }

    uint256 stakeAmount = getStakeBalance(account);
    uint256 stakeDecayed = stakeAmount.mul(endTS - current).div(endTS - startTS);

    if (stakeDecayed >= stakeAmount) {
      return stakeAmount;
    }
    return stakeDecayed;
  }

  function calcReward(address holder)
    external
    view
    override
    returns (uint256 amount, uint32 since)
  {
    (uint32 startTS, uint32 endTS) = expiryOf(holder);
    if (endTS == 0) {
      return (0, 0);
    }

    uint256 stakeAmount;
    uint32 current = getCurrentTick();
    if (current >= endTS) {
      // this is to emulate claimReward using calcCompensatedDecay when a balance has expired
      stakeAmount = getStakeBalance(holder);
      current = endTS;
    }

    (amount, since) = super.doCalcRewardAt(holder, current);
    if (amount == 0) {
      return (0, 0);
    }

    uint256 decayAmount = amount.rayMul(calcDecayForReward(startTS, endTS, since, current));

    amount =
      amount -
      calcCompensatedDecay(
        holder,
        decayAmount,
        stakeAmount,
        totalSupply(),
        calcDecayTimeCompensation(startTS, endTS, since, current)
      );

    if (amount == 0) {
      return (0, 0);
    }

    return (amount, since);
  }

  function internalClaimReward(address holder, uint256 limit)
    internal
    virtual
    override
    returns (uint256 amount, uint32 since)
  {
    internalUpdate(true, 0);

    (uint32 startTS, uint32 endTS) = expiryOf(holder);
    if (endTS == 0) {
      return (0, 0);
    }

    uint256 stakeAmount; // cached value as it may not be available after removal

    uint256 maxAmount;
    uint32 current = getCurrentTick();
    if (current >= endTS) {
      current = endTS;
      (maxAmount, since) = super.doGetRewardAt(holder, current);
      stakeAmount = super.internalRemoveReward(holder);
    } else {
      (maxAmount, since) = super.doGetRewardAt(holder, current);
    }

    if (maxAmount == 0) {
      return (0, 0);
    }

    uint256 decayAmount = maxAmount.rayMul(calcDecayForReward(startTS, endTS, since, current));

    if (limit <= maxAmount && limit + decayAmount <= maxAmount) {
      amount = limit;
      console.log('internalClaimReward (limit below decay)', decayAmount, limit);
    } else {
      amount =
        maxAmount -
        calcCompensatedDecay(
          holder,
          decayAmount,
          stakeAmount,
          internalCurrentTotalSupply(),
          calcDecayTimeCompensation(startTS, endTS, since, current)
        );

      console.log(
        'internalClaimReward (compensated)',
        maxAmount,
        decayAmount,
        decayAmount - (maxAmount - amount)
      );

      if (amount > limit) {
        console.log('internalClaimReward (limit applied)', limit);
        amount = limit;
      }
    }

    if (maxAmount > amount) {
      console.log('internalClaimReward (excess)', maxAmount - amount);
      internalAddExcess(maxAmount - amount, since);
    }

    if (amount == 0) {
      return (0, 0);
    }

    return (amount, since);
  }

  function pushStakeBalance(address holder, uint32 at) internal virtual override {
    (uint256 amount, uint32 since) = doGetRewardAt(holder, at);
    if (amount == 0) {
      return;
    }
    (uint32 startTS, uint32 endTS) = expiryOf(holder);
    uint256 maxAmount = amount;

    uint256 decayAmount = maxAmount.rayMul(calcDecayForReward(startTS, endTS, since, at));

    amount =
      maxAmount -
      calcCompensatedDecay(
        holder,
        decayAmount,
        0,
        internalCurrentTotalSupply(),
        calcDecayTimeCompensation(startTS, endTS, since, at)
      );

    if (maxAmount > amount) {
      internalAddExcess(maxAmount - amount, since);
    }

    super.internalAllocateReward(holder, amount, since, AllocationMode.Push);
  }

  /// @notice Calculates a range integral of the linear decay
  /// @param startTS start of the decay interval (beginning of a lock)
  /// @param endTS start of the decay interval (ending of a lock)
  /// @param since start of an integration range
  /// @param current end of an integration range
  /// @return Decayed portion [RAY..0] of reward, result = 0 means no decay
  function calcDecayForReward(
    uint32 startTS,
    uint32 endTS,
    uint32 since,
    uint32 current
  ) public pure returns (uint256) {
    require(startTS < endTS);
    require(startTS <= since);
    require(current <= endTS);
    require(since <= current);
    return
      ((uint256(since - startTS) + (current - startTS)) * WadRayMath.halfRAY) / (endTS - startTS);
  }

  /// @notice Calculates an approximate decay compensation to equalize outcomes from multiple intermediate claims vs one final claim due to excess redistribution
  /// @dev There is no checks as it is invoked only after calcDecayForReward
  /// @param startTS start of the decay interval (beginning of a lock)
  /// @param endTS start of the decay interval (ending of a lock)
  /// @param since timestamp of a previous claim or start of the decay interval
  /// @param current timestamp of a new claim
  /// @return Compensation portion [RAY..0] of reward, result = 0 means no compensation
  function calcDecayTimeCompensation(
    uint32 startTS,
    uint32 endTS,
    uint32 since,
    uint32 current
  ) public pure returns (uint256) {
    // parabolic approximation
    return ((uint256(current - since)**2) * WadRayMath.RAY) / (uint256(endTS - startTS)**2);

    // uint32 width = endTS - startTS;
    // // logariphmic component to give a large compensation for longer distance between (since) and (current)
    // // bitLength provides a cheap alternative of log(x) when x is expanded to more bits
    // uint256 v = (255 - BitUtils.bitLength((type(uint256).max / width) * (width - (current - since)))) * WadRayMath.RAY / 255;
    // v *= 7;

    // // linear component to give a small non-zero compensation for smaller distance between (since) and (current)
    // v += uint256(current - since) * WadRayMath.RAY / width;

    // return v>>3;
  }

  function calcCompensatedDecay(
    address holder,
    uint256 decayAmount,
    uint256 stakeAmount,
    uint256 stakedTotal,
    uint256 compensationRatio
  ) public view returns (uint256) {
    console.log('calcCompensatedDecay', decayAmount, stakeAmount, compensationRatio);
    if (decayAmount == 0 || compensationRatio == 0) {
      return decayAmount;
    }

    if (stakeAmount == 0) {
      // is included in the total
      stakeAmount = getStakeBalance(holder);
    } else {
      // is excluded from the total
      stakedTotal += stakeAmount;
    }

    if (stakedTotal > stakeAmount) {
      compensationRatio = (compensationRatio * stakeAmount) / stakedTotal;
    }

    if (compensationRatio >= WadRayMath.RAY) {
      return 0;
    }

    return decayAmount.rayMul(WadRayMath.RAY - compensationRatio);
  }
}
