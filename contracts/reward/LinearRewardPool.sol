// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {IRewardController} from './IRewardController.sol';
import {BasicRewardPool} from './BasicRewardPool.sol';

import 'hardhat/console.sol';

contract LinearRewardPool is BasicRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;
  uint256 private _blockRate; // rays, linear
  // _lastUpdateBlock must NOT be set past-cutOff
  uint32 private _lastUpdateBlock;

  mapping(address => RewardEntry) private _rewards;

  constructor(IRewardController controller) public BasicRewardPool(controller) {}

  function isLazy() external view override returns (bool) {
    return true;
  }

  function internalGetRate() internal view override returns (uint256) {
    return _blockRate;
  }

  function internalSetRate(uint256 blockRate, uint32 currentBlock) internal override {
    require(currentBlock >= _lastUpdateBlock, 'retroactive update');

    if (_lastUpdateBlock == 0) {
      if (blockRate == 0) {
        return;
      }
      _blockRate = blockRate;
      _lastUpdateBlock = currentBlock;
      return;
    }
    if (_blockRate == blockRate) {
      return;
    }
    if (_lastUpdateBlock == currentBlock) {
      _blockRate = blockRate;
      return;
    }
    _accumRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    _lastUpdateBlock = currentBlock;
  }

  struct RewardEntry {
    uint256 rewardBase;
    uint256 lastAccumRate;
  }

  function internalCalcRateAndReward(address holder, uint32 currentBlock)
    internal
    view
    returns (uint256 rate, uint256 allocated)
  {
    if (isCutOff(currentBlock)) {
      currentBlock = internalGetCutOff();
    }

    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    return (
      adjRate,
      _rewards[holder].rewardBase.rayMul(adjRate.sub(_rewards[holder].lastAccumRate))
    );
  }

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal override returns (uint256) {
    oldBalance;
    totalSupply;

    (uint256 adjRate, uint256 allocated) = internalCalcRateAndReward(holder, currentBlock);
    _rewards[holder].lastAccumRate = adjRate;
    _rewards[holder].rewardBase = newBalance;
    return allocated;
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    override
    returns (uint256)
  {
    if (_rewards[holder].rewardBase == 0) {
      return 0;
    }

    (uint256 adjRate, uint256 allocated) = internalCalcRateAndReward(holder, currentBlock);
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

    (, uint256 allocated) = internalCalcRateAndReward(holder, currentBlock);
    return allocated;
  }
}
