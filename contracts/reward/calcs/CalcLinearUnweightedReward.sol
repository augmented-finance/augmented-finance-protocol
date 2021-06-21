// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {CalcLinearRateReward} from './CalcLinearRateReward.sol';

import 'hardhat/console.sol';

abstract contract CalcLinearUnweightedReward is CalcLinearRateReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal override {
    _accumRate = _accumRate.add(lastRate.mul(currentBlock - lastBlock));
  }

  function internalCalcRateAndReward(
    RewardEntry memory entry,
    uint256 lastAccumRate,
    uint32 currentBlock
  )
    internal
    view
    virtual
    override
    returns (
      uint256 rate,
      uint256 allocated,
      uint32 since
    )
  {
    // console.log('internalCalcRateAndReward, blocks ', currentBlock, getRateUpdateBlock());

    uint256 adjRate = _accumRate.add(getLinearRate().mul(currentBlock - getRateUpdateBlock()));
    allocated = uint256(entry.rewardBase).rayMul(adjRate.sub(lastAccumRate));

    // console.log('internalCalcRateAndReward, entry ', entry.rewardBase, entry.lastAccumRate);
    // console.log('internalCalcRateAndReward, result ', adjRate, allocated);

    return (adjRate, allocated, entry.lastUpdate);
  }
}
