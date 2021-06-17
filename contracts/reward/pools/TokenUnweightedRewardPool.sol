// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {BaseTokenAbsRewardPool} from './BaseTokenAbsRewardPool.sol';
import {CalcLinearUnweightedReward} from '../calcs/CalcLinearUnweightedReward.sol';

import 'hardhat/console.sol';

contract TokenUnweightedRewardPool is BaseTokenAbsRewardPool, CalcLinearUnweightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public BaseTokenAbsRewardPool(controller, initialRate, baselinePercentage) {}

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

  function internalUpdateTotal(uint256 totalBalance) internal override {}

  function getCurrentBlock() internal view override returns (uint32) {
    return uint32(block.number);
  }
}
