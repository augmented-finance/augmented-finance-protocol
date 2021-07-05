// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {AllocationMode} from '../interfaces/IRewardController.sol';

import 'hardhat/console.sol';

abstract contract CalcLinearRateReward {
  using SafeMath for uint256;

  mapping(address => RewardEntry) private _rewards;
  uint256 private _rate;
  uint32 private _lastRateUpdateAt;

  mapping(address => uint256) _accumRates;

  struct RewardEntry {
    uint224 rewardBase;
    uint32 lastUpdate;
  }

  function setLinearRate(uint256 rate) internal {
    setLinearRateAt(rate, getCurrentTick());
  }

  function setLinearRateAt(uint256 rate, uint32 at) internal {
    if (_rate == rate) {
      return;
    }
    uint256 prevRate = _rate;
    uint32 prevTick = _lastRateUpdateAt;
    internalMarkRateUpdate(at);
    _rate = rate;
    console.log('setLinearRateAt', _rate, prevRate, prevTick);
    internalRateUpdated(prevRate, prevTick);
  }

  function getCurrentTick() internal view virtual returns (uint32);

  function internalRateUpdated(uint256 lastRate, uint32 lastAt) internal virtual;

  function internalMarkRateUpdate(uint32 currentTick) internal {
    console.log('internalMarkRateUpdate', _lastRateUpdateAt, currentTick, block.timestamp);
    require(currentTick >= _lastRateUpdateAt, 'retroactive update');
    _lastRateUpdateAt = currentTick;
  }

  function getLinearRate() internal view virtual returns (uint256) {
    return _rate;
  }

  function getRateUpdatedAt() internal view returns (uint32) {
    return _lastRateUpdateAt;
  }

  function internalCalcRateAndReward(
    RewardEntry memory entry,
    uint256 lastAccumRate,
    uint32 currentTick
  )
    internal
    view
    virtual
    returns (
      uint256 rate,
      uint256 allocated,
      uint32 since
    );

  function getRewardEntry(address holder) internal view returns (RewardEntry memory) {
    return _rewards[holder];
  }

  function doUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 since,
      AllocationMode mode
    )
  {
    require(newBalance <= type(uint224).max, 'balance is too high');

    RewardEntry memory entry = _rewards[holder];

    if (newBalance == 0) {
      mode = AllocationMode.UnsetPull;
    } else if (entry.lastUpdate == 0) {
      mode = AllocationMode.SetPull;
    } else {
      mode = AllocationMode.Push;
    }

    newBalance = internalCalcBalance(entry, oldBalance, newBalance);
    require(newBalance <= type(uint224).max, 'balance is too high');

    uint32 currentTick = getCurrentTick();

    uint256 adjRate;
    (adjRate, allocated, since) = internalCalcRateAndReward(
      entry,
      _accumRates[holder],
      currentTick
    );
    // console.log('internalUpdateReward: ', adjRate, allocated);

    _accumRates[holder] = adjRate;
    _rewards[holder] = RewardEntry(uint224(newBalance), currentTick);
    return (allocated, since, mode);
  }

  function doOverrideReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance
  ) internal virtual returns (uint32 since, AllocationMode mode) {
    require(newBalance <= type(uint224).max, 'balance is too high');

    RewardEntry memory entry = _rewards[holder];

    if (newBalance == 0) {
      mode = AllocationMode.UnsetPull;
    } else if (entry.lastUpdate == 0) {
      mode = AllocationMode.SetPull;
    } else {
      mode = AllocationMode.Push;
    }

    newBalance = internalCalcBalance(entry, oldBalance, newBalance);
    require(newBalance <= type(uint224).max, 'balance is too high');

    uint32 currentTick = getCurrentTick();

    entry.rewardBase = 0;
    uint256 adjRate;
    uint256 allocated;

    (adjRate, allocated, since) = internalCalcRateAndReward(
      entry,
      _accumRates[holder],
      currentTick
    );
    require(allocated == 0);

    _accumRates[holder] = adjRate;
    _rewards[holder] = RewardEntry(uint224(newBalance), currentTick);
    return (since, mode);
  }

  function internalCalcBalance(
    RewardEntry memory entry,
    uint256 oldBalance,
    uint256 newBalance
  ) internal pure virtual returns (uint256) {
    entry;
    oldBalance;
    return newBalance;
  }

  // function internalCalcBalance(
  //   RewardEntry memory entry,
  //   uint256 oldBalance,
  //   uint256 newBalance
  // ) internal view virtual returns (uint256) {
  //   this;
  //   if (newBalance >= oldBalance) {
  //     return uint256(entry.rewardBase).add(newBalance - oldBalance);
  //   }
  //   return uint256(entry.rewardBase).sub(oldBalance - newBalance);
  // }

  function internalRemoveReward(address holder) internal virtual returns (uint256 rewardBase) {
    rewardBase = _rewards[holder].rewardBase;
    if (rewardBase == 0 && _rewards[holder].lastUpdate == 0) {
      return 0;
    }
    delete (_rewards[holder]);
    return rewardBase;
  }

  function doGetReward(address holder) internal virtual returns (uint256, uint32) {
    return doGetRewardAt(holder, getCurrentTick());
  }

  function doGetRewardAt(address holder, uint32 currentTick)
    internal
    virtual
    returns (uint256, uint32)
  {
    if (_rewards[holder].rewardBase == 0) {
      return (0, 0);
    }

    // console.log('internalCalcRateAndReward: ', _rewards[holder].lastUpdate, currentTick);
    // console.log(_accumRates[holder], _rewards[holder].rewardBase);

    (uint256 adjRate, uint256 allocated, uint32 since) =
      internalCalcRateAndReward(_rewards[holder], _accumRates[holder], currentTick);

    // console.log(adjRate, allocated, since);

    _accumRates[holder] = adjRate;
    _rewards[holder].lastUpdate = currentTick;
    return (allocated, since);
  }

  function doCalcReward(address holder) internal view virtual returns (uint256, uint32) {
    return doCalcRewardAt(holder, getCurrentTick());
  }

  function doCalcRewardAt(address holder, uint32 currentTick)
    internal
    view
    virtual
    returns (uint256, uint32)
  {
    if (_rewards[holder].rewardBase == 0) {
      return (0, 0);
    }

    (, uint256 allocated, uint32 since) =
      internalCalcRateAndReward(_rewards[holder], _accumRates[holder], currentTick);
    return (allocated, since);
  }
}
