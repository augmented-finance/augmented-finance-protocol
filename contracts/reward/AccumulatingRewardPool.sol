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

  constructor(IRewardController controller) public BasicRewardPool(controller) {}

  function isLazy() public view override returns (bool) {
    return true;
  }

  struct RewardEntry {
    uint256 rewardBase;
    uint256 lastAccumRate;
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    virtual
    returns (uint256 rate, uint256 allocated);

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal virtual override returns (uint256 allocated, bool newcomer) {
    oldBalance;
    totalSupply;

    if (isCutOff(currentBlock)) {
      currentBlock = internalGetCutOff();
    }

    RewardEntry memory entry = _rewards[holder];
    if (entry.lastAccumRate == 0 && entry.rewardBase == 0) {
      newcomer = true;
    }

    uint256 adjRate;
    (adjRate, allocated) = internalCalcRateAndReward(_rewards[holder], currentBlock);
    console.log('internalUpdateReward: ', adjRate, allocated);

    _rewards[holder].lastAccumRate = adjRate;
    _rewards[holder].rewardBase = newBalance;
    return (allocated, newcomer);
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    override
    returns (uint256)
  {
    if (_rewards[holder].rewardBase == 0) {
      return 0;
    }

    if (isCutOff(currentBlock)) {
      currentBlock = internalGetCutOff();
    }

    (uint256 adjRate, uint256 allocated) =
      internalCalcRateAndReward(_rewards[holder], currentBlock);
    _rewards[holder].lastAccumRate = adjRate;
    return allocated;
  }

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    override
    returns (uint256)
  {
    if (_rewards[holder].rewardBase == 0) {
      return 0;
    }

    if (isCutOff(currentBlock)) {
      currentBlock = internalGetCutOff();
    }

    (, uint256 allocated) = internalCalcRateAndReward(_rewards[holder], currentBlock);
    return allocated;
  }
}
