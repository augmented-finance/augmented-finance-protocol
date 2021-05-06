// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {MonoTokenRewardPool} from './MonoTokenRewardPool.sol';
import {CalcLinearUnweightedReward} from './CalcLinearUnweightedReward.sol';

import 'hardhat/console.sol';

contract LinearUnweightedRewardPool is MonoTokenRewardPool, CalcLinearUnweightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address token
  ) public MonoTokenRewardPool(controller, initialRate, baselinePercentage, token) {}

  function getRate() public view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate, uint32 currentBlock) internal override {
    super.setLinearRate(newRate, currentBlock);
  }

  function internalUpdateTotalSupply(
    address,
    uint256,
    uint256,
    uint32
  ) internal override returns (bool) {
    return false;
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
    address provider,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
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
    return doUpdateReward(provider, holder, oldBalance, newBalance, totalSupply, currentBlock);
  }
}
