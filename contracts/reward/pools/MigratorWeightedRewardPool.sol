// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {CalcLinearWeightedReward} from '../calcs/CalcLinearWeightedReward.sol';
import {BaseTokenDiffRewardPool} from './BaseTokenDiffRewardPool.sol';

import 'hardhat/console.sol';

contract MigratorWeightedRewardPool is BaseTokenDiffRewardPool, CalcLinearWeightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint224 rateScale,
    uint16 baselinePercentage,
    uint256 maxTotalSupply,
    address token
  )
    public
    BaseTokenDiffRewardPool(controller, initialRate, rateScale, baselinePercentage, token)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate) internal override {
    super.setLinearRate(newRate);
  }

  function internalGetReward(address holder) internal override returns (uint256, uint32) {
    return doGetReward(holder);
  }

  function internalCalcReward(address holder) internal view override returns (uint256, uint32) {
    return doCalcReward(holder);
  }

  function internalUpdateReward(
    address,
    address holder,
    uint256 oldBalance,
    uint256 newBalance
  )
    internal
    override
    returns (
      uint256 allocated,
      uint32 sinceBlock,
      AllocationMode mode
    )
  {
    return doUpdateReward(holder, oldBalance, newBalance);
  }

  function internalUpdateSupplyDiff(uint256 oldSupply, uint256 newSupply) internal override {
    doUpdateTotalSupplyDiff(oldSupply, newSupply);
  }

  function internalCalcBalance(
    RewardEntry memory entry,
    uint256 oldBalance,
    uint256 newBalance
  ) internal pure override returns (uint256) {
    if (newBalance >= oldBalance) {
      return uint256(entry.rewardBase).add(newBalance - oldBalance);
    }
    return uint256(entry.rewardBase).sub(oldBalance - newBalance);
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }
}
