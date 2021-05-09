// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {CalcLinearWeightedReward} from './CalcLinearWeightedReward.sol';
import {MonoTokenRewardPool} from './MonoTokenRewardPool.sol';

import 'hardhat/console.sol';

contract LinearWeightedRewardPool is MonoTokenRewardPool, CalcLinearWeightedReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address token,
    uint256 maxTotalSupply
  )
    public
    MonoTokenRewardPool(controller, initialRate, baselinePercentage, token)
    CalcLinearWeightedReward(maxTotalSupply)
  {}

  function getRate() public view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate, uint32 currentBlock) internal override {
    super.setLinearRate(newRate, currentBlock);
  }

  function internalUpdateTotalSupply(
    address,
    uint256 oldSupply,
    uint256 newSupply,
    uint32 currentBlock
  ) internal override returns (bool) {
    if (oldSupply == newSupply) {
      return false;
    }
    doUpdateTotalSupply(oldSupply, newSupply, currentBlock);
    return true;
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

  function handleScaledBalanceUpdate(
    address,
    address,
    uint256,
    uint256,
    uint256,
    uint256
  ) external override {
    revert('not implemented');
  }
}
