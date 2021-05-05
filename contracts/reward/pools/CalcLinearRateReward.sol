// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {MonoTokenRewardPool} from './MonoTokenRewardPool.sol';

import 'hardhat/console.sol';

abstract contract CalcLinearRateReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  mapping(address => RewardEntry) private _rewards;
  uint256 private _rate;
  uint32 private _lastRateUpdateBlock;

  struct RewardEntry {
    uint256 lastAccumRate;
    uint224 rewardBase;
    uint32 lastUpdateBlock;
  }

  function setLinearRate(uint256 rate, uint32 currentBlock) internal {
    if (_rate == rate) {
      return;
    }
    uint256 prevRate = _rate;
    uint32 prevBlock = _lastRateUpdateBlock;
    internalRateUpdate(rate, currentBlock);
    internalRateUpdated(prevRate, prevBlock, currentBlock);
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual;

  function internalRateUpdate(uint256 newRate, uint32 currentBlock) internal virtual {
    require(currentBlock >= _lastRateUpdateBlock, 'retroactive update');
    _rate = newRate;
    _lastRateUpdateBlock = currentBlock;
  }

  function getLinearRate() internal view virtual returns (uint256) {
    return _rate;
  }

  function getRateUpdateBlock() internal view returns (uint32) {
    return _lastRateUpdateBlock;
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    virtual
    returns (
      uint256 rate,
      uint256 allocated,
      uint32 since
    );

  function doUpdateReward(
    address provider,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 since,
      bool newcomer
    )
  {
    require(newBalance <= type(uint224).max, 'balance is too high');
    oldBalance;
    totalSupply;

    RewardEntry memory entry = _rewards[holder];
    if (entry.lastUpdateBlock == 0) {
      newcomer = true;
    }

    newBalance = internalCalcBalance(provider, entry, oldBalance, newBalance);
    require(newBalance <= type(uint224).max, 'balance is too high');

    uint256 adjRate;
    (adjRate, allocated, since) = internalCalcRateAndReward(entry, currentBlock);
    // console.log('internalUpdateReward: ', adjRate, allocated);

    _rewards[holder].lastAccumRate = adjRate;
    _rewards[holder].rewardBase = uint224(newBalance);
    _rewards[holder].lastUpdateBlock = currentBlock;
    return (allocated, since, newcomer);
  }

  function internalCalcBalance(
    address provider,
    RewardEntry memory entry,
    uint256 oldBalance,
    uint256 newBalance
  ) internal view virtual returns (uint256) {
    provider;
    this;
    if (newBalance >= oldBalance) {
      return uint256(entry.rewardBase).add(newBalance - oldBalance);
    }
    return uint256(entry.rewardBase).sub(oldBalance - newBalance);
  }

  function internalRemoveReward(address holder) internal virtual returns (uint256 rewardBase) {
    rewardBase = _rewards[holder].rewardBase;
    if (rewardBase == 0 && _rewards[holder].lastUpdateBlock == 0) {
      return 0;
    }
    delete (_rewards[holder]);
    return rewardBase;
  }

  function doGetReward(address holder, uint32 currentBlock)
    internal
    virtual
    returns (uint256, uint32)
  {
    if (_rewards[holder].rewardBase == 0) {
      return (0, 0);
    }

    (uint256 adjRate, uint256 allocated, uint32 since) =
      internalCalcRateAndReward(_rewards[holder], currentBlock);
    _rewards[holder].lastAccumRate = adjRate;
    _rewards[holder].lastUpdateBlock = currentBlock;
    return (allocated, since);
  }

  function doCalcReward(address holder, uint32 currentBlock)
    internal
    view
    virtual
    returns (uint256, uint32)
  {
    if (_rewards[holder].rewardBase == 0) {
      return (0, 0);
    }

    (, uint256 allocated, uint32 since) = internalCalcRateAndReward(_rewards[holder], currentBlock);
    return (allocated, since);
  }
}
