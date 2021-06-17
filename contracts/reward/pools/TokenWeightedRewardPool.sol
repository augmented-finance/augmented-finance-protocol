// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {CalcLinearWeightedReward} from '../calcs/CalcLinearWeightedReward.sol';
import {BaseTokenAbsRewardPool} from './BaseTokenAbsRewardPool.sol';

import 'hardhat/console.sol';

contract TokenWeightedRewardPool is BaseTokenAbsRewardPool, CalcLinearWeightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    uint256 maxTotalSupply
  )
    public
    BaseTokenAbsRewardPool(controller, initialRate, baselinePercentage)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function getRate() public view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate, uint32 currentBlock) internal override {
    super.setLinearRate(newRate, currentBlock);
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    override
    returns (uint256, uint32)
  {
    return doGetReward(holder, currentBlock);
  }

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    override
    returns (uint256, uint32)
  {
    return doCalcReward(holder, currentBlock);
  }

  function internalUpdateReward(
    address,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint32 currentBlock
  )
    internal
    override
    returns (
      uint256 allocated,
      uint32 since,
      AllocationMode mode
    )
  {
    return doUpdateReward(holder, oldBalance, newBalance, currentBlock);
  }

  function internalUpdateTotal(uint256 totalBalance, uint32 currentBlock) internal override {
    doUpdateTotalSupply(totalBalance, currentBlock);
  }
}
