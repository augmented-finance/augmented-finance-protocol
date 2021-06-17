// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {CalcLinearWeightedReward} from '../calcs/CalcLinearWeightedReward.sol';
import {BaseDecayRewardPool} from './BaseDecayRewardPool.sol';

import 'hardhat/console.sol';

contract TokenEolWeightedRewardPool is BaseDecayRewardPool, CalcLinearWeightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    uint256 maxTotalSupply
  )
    public
    BaseDecayRewardPool(controller, initialRate, baselinePercentage)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function getRate() public view override returns (uint256) {
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
    address holder,
    uint256 newBalance,
    uint32 decayPeriod
  )
    internal
    override
    returns (
      uint256 allocated,
      uint32 sinceBlock,
      AllocationMode mode
    )
  {
    decayPeriod;
    return
      doUpdateReward(
        holder,
        0, /* matters not here */
        newBalance
      );
  }

  function internalUpdateTotal(
    uint256 totalBalance,
    uint256 totalDecay,
    uint32 decayPeriod,
    uint32 updatedAt
  ) internal override {
    totalDecay;
    decayPeriod;
    updatedAt;
    doUpdateTotalSupply(totalBalance);
  }

  function getCurrentBlock() internal view override returns (uint32) {
    return uint32(block.number);
  }
}
