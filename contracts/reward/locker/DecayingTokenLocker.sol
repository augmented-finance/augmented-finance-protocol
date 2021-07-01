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

  function balanceOf(address account) external view virtual override returns (uint256) {
    (uint256 stakeAmount, uint32 startTS, uint32 endTS) = internalBalanceOf(account);
    console.log('balanceOf', stakeAmount, startTS, endTS);

    if (stakeAmount == 0) {
      return 0;
    }

    console.log('balanceOf', block.timestamp, endTS - uint32(block.timestamp), endTS - startTS);

    uint256 stakeDecayed =
      uint256(stakeAmount).mul(endTS - uint32(block.timestamp)).div(endTS - startTS);

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

    amount = amount.rayMul(WadRayMath.RAY - calcDecayForReward(startTS, endTS, since, current));
    if (amount == 0) {
      return (0, 0);
    }

    return (amount, since);
  }

  /// @notice Calculates an approximation of a range integral of the linear decay
  /// @param startTS start of the decay interval (beginning of a lock)
  /// @param endTS start of the decay interval (ending of a lock)
  /// @param since start of an integration range
  /// @param current end of an integration range
  /// @return Decayed portion [RAY..0] of reward, result = 0 means no decay
  function calcDecayForReward(
    uint32 startTS,
    uint256 endTS,
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

  /// @notice Calculates an approximation of a range integral of the linear decay
  /// @param startTS start of the decay interval and of integration range (beginning of a lock)
  /// @param endTS start of the decay interval (ending of a lock)
  /// @param at end of an integration range
  /// @return Decayed portion [RAY..0] of reward, result = 0 means no decay
  function calcRewardCompensatedDecay(
    uint32 startTS,
    uint256 endTS,
    uint32 at
  ) public pure returns (uint256) {
    // linear decay component
    uint256 v0 = ((at - startTS) * WadRayMath.RAY) / (endTS - startTS);

    // logariphmic decay component
    // bitLength provides a cheap alternative of log(x) when x is expanded to 256 bits
    uint256 u = type(uint256).max / (endTS - startTS);
    uint256 v1 = (BitUtils.bitLength(u * (at - startTS)) * WadRayMath.RAY) / 255;

    return (v0 + v1) >> 2;
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
    amount = amount.rayMul(WadRayMath.RAY - calcDecayForReward(startTS, endTS, since, current));

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
