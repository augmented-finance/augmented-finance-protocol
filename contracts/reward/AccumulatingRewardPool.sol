// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {IRewardController} from './interfaces/IRewardController.sol';
import {BasicRewardPool} from './BasicRewardPool.sol';

import 'hardhat/console.sol';

abstract contract AccumulatingRewardPool is BasicRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  mapping(address => RewardEntry) private _rewards;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public BasicRewardPool(controller, initialRate, baselinePercentage) {}

  function isLazy() public view override returns (bool) {
    return true;
  }

  struct RewardEntry {
    uint256 lastAccumRate;
    uint224 rewardBase;
    uint32 lastUpdateBlock;
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

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  )
    internal
    virtual
    override
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

    uint256 adjRate;
    (adjRate, allocated, since) = internalCalcRateAndReward(_rewards[holder], currentBlock);
    console.log('internalUpdateReward: ', adjRate, allocated);

    _rewards[holder].lastAccumRate = adjRate;
    _rewards[holder].rewardBase = uint224(newBalance);
    _rewards[holder].lastUpdateBlock = currentBlock;
    return (allocated, since, newcomer);
  }

  function internalRemoveReward(address holder) internal virtual returns (uint256 rewardBase) {
    rewardBase = _rewards[holder].rewardBase;
    if (rewardBase == 0 && _rewards[holder].lastUpdateBlock == 0) {
      return 0;
    }
    delete (_rewards[holder]);
    return rewardBase;
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    virtual
    override
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

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    virtual
    override
    returns (uint256, uint32)
  {
    if (_rewards[holder].rewardBase == 0) {
      return (0, 0);
    }

    (, uint256 allocated, uint32 since) = internalCalcRateAndReward(_rewards[holder], currentBlock);
    return (allocated, since);
  }
}
