// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {IRewardController} from './IRewardController.sol';
import {AccumulatingRewardPool} from './AccumulatingRewardPool.sol';

import 'hardhat/console.sol';

contract LinearUnweightedRewardPool is AccumulatingRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;

  constructor(IRewardController controller) public AccumulatingRewardPool(controller) {}

  function internalUpdateTotalSupply(
    address,
    uint256,
    uint256,
    uint32
  ) internal override {}

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual override {
    _accumRate = _accumRate.add(lastRate.mul(currentBlock - lastBlock));
    super.internalRateUpdated(lastRate, lastBlock, currentBlock);
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    override
    returns (uint256 rate, uint256 allocated)
  {
    console.log('internalCalcRateAndReward, blocks ', currentBlock, internalGetLastUpdateBlock());

    uint256 adjRate =
      _accumRate.add(internalGetRate().mul(currentBlock - internalGetLastUpdateBlock()));
    allocated = entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate));

    console.log('internalCalcRateAndReward, entry ', entry.rewardBase, entry.lastAccumRate);
    console.log('internalCalcRateAndReward, result ', adjRate, allocated);

    return (adjRate, allocated);
  }
}
