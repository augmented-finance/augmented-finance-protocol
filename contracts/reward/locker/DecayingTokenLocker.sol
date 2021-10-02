// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/WadRayMath.sol';
import '../interfaces/IRewardController.sol';
import './RewardedTokenLocker.sol';

contract DecayingTokenLocker is RewardedTokenLocker {
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address underlying
  ) RewardedTokenLocker(controller, initialRate, baselinePercentage, underlying) {}

  function balanceOf(address account) public view virtual override returns (uint256) {
    (uint32 startTS, uint32 endTS) = expiryOf(account);
    uint32 current = getCurrentTick();
    if (current >= endTS) {
      return 0;
    }

    uint256 stakeAmount = getStakeBalance(account);
    uint256 stakeDecayed = (stakeAmount * (endTS - current)) / (endTS - startTS);

    if (stakeDecayed >= stakeAmount) {
      return stakeAmount;
    }
    return stakeDecayed;
  }

  function internalCalcReward(address holder, uint32 current)
    internal
    view
    override
    returns (uint256 amount, uint32 since)
  {
    (uint32 startTS, uint32 endTS) = expiryOf(holder);
    if (endTS == 0) {
      return (0, 0);
    }

    uint256 stakeAmount;
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

  function internalGetReward(address holder)
    internal
    override
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull
    )
  {
    return _getRewardWithLimit(holder, type(uint256).max);
  }

  function internalGetRewardWithLimit(
    address holder,
    uint256 baseAmount,
    uint256 limit,
    uint16 minBoostPct
  )
    internal
    override
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull,
      uint256 // newLimit,
    )
  {
    if (minBoostPct == 0) {
      (amount, since, keepPull) = _getRewardWithLimit(holder, limit > baseAmount ? limit - baseAmount : 0);
      amount += baseAmount;
    } else {
      (amount, since, keepPull) = _getRewardWithLimit(holder, type(uint256).max);
      amount += baseAmount;
      limit += PercentageMath.percentMul(amount, minBoostPct);
    }

    if (amount > limit) {
      internalAddExcess(amount - limit, since);
      amount = limit;
    }

    return (amount, since, keepPull, limit);
  }

  function _getRewardWithLimit(address holder, uint256 limit)
    private
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull
    )
  {
    internalUpdate(true, 0);

    (uint32 startTS, uint32 endTS) = expiryOf(holder);
    if (endTS == 0) {
      return (0, 0, false);
    }

    uint256 stakeAmount; // cached value as it may not be available after removal

    uint256 maxAmount;
    uint32 current = getCurrentTick();
    if (current >= endTS) {
      current = endTS;
      (maxAmount, since, ) = super.doGetRewardAt(holder, current);
      stakeAmount = super.doRemoveRewardBalance(holder);
      keepPull = false;
    } else {
      (maxAmount, since, keepPull) = super.doGetRewardAt(holder, current);
    }

    if (maxAmount == 0) {
      return (0, 0, keepPull);
    }

    uint256 decayAmount = maxAmount.rayMul(calcDecayForReward(startTS, endTS, since, current));

    if (limit <= maxAmount && limit + decayAmount <= maxAmount) {
      amount = limit;
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

      if (amount > limit) {
        amount = limit;
      }
    }

    if (maxAmount > amount) {
      internalAddExcess(maxAmount - amount, since);
    }

    if (amount == 0) {
      return (0, 0, keepPull);
    }

    return (amount, since, keepPull);
  }

  function setStakeBalance(address holder, uint224 stakeAmount) internal override {
    // NB! Actually, total and balance for decay compensation should be taken before the update.
    // Not doing it will give more to a user who increases balance - so it is even better in this case.

    (uint256 amount, uint32 since, AllocationMode mode) = doUpdateRewardBalance(holder, stakeAmount);
    amount = rewardForBalance(holder, stakeAmount, amount, since, uint32(block.timestamp));
    internalAllocateReward(holder, amount, since, mode);
  }

  function unsetStakeBalance(address holder, uint32 at) internal override {
    (uint256 amount, uint32 since, ) = doGetRewardAt(holder, at);
    uint256 stakeAmount = doRemoveRewardBalance(holder);
    if (amount == 0) {
      return;
    }
    amount = rewardForBalance(holder, stakeAmount, amount, since, at);
    internalAllocateReward(holder, amount, since, AllocationMode.Push);
  }

  function rewardForBalance(
    address holder,
    uint256 stakeAmount,
    uint256 amount,
    uint32 since,
    uint32 at
  ) private returns (uint256) {
    if (amount == 0) {
      return 0;
    }
    (uint32 startTS, uint32 endTS) = expiryOf(holder);

    uint256 maxAmount = amount;
    uint256 decayAmount = maxAmount.rayMul(calcDecayForReward(startTS, endTS, since, at));

    amount =
      maxAmount -
      calcCompensatedDecay(
        holder,
        decayAmount,
        stakeAmount,
        internalCurrentTotalSupply(),
        calcDecayTimeCompensation(startTS, endTS, since, at)
      );

    if (maxAmount > amount) {
      internalAddExcess(maxAmount - amount, since);
    }

    return amount;
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
    require(startTS > 0);
    require(startTS < endTS);
    require(startTS <= since);
    require(current <= endTS);
    require(since <= current);
    return ((uint256(since - startTS) + (current - startTS)) * WadRayMath.halfRAY) / (endTS - startTS);
  }

  /// @dev Calculates an approximate decay compensation to equalize outcomes from multiple intermediate claims vs
  /// one final claim due to excess redistribution.
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
  }

  function calcCompensatedDecay(
    address holder,
    uint256 decayAmount,
    uint256 stakeAmount,
    uint256 stakedTotal,
    uint256 compensationRatio
  ) public view returns (uint256) {
    if (decayAmount == 0 || compensationRatio == 0) {
      return decayAmount;
    }

    if (stakeAmount == 0) {
      // is included into the total
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
