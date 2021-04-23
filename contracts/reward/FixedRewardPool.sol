// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {IRewardController} from './interfaces/IRewardController.sol';
import {BasicRewardPool} from './BasicRewardPool.sol';

import 'hardhat/console.sol';

contract FixedRewardPool is BasicRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public BasicRewardPool(controller, initialRate, baselinePercentage) {}

  function isLazy() public view override returns (bool) {
    return false;
  }

  function internalUpdateTotalSupply(
    address,
    uint256,
    uint256,
    uint32
  ) internal override {}

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal override returns (uint256, bool) {
    require(newBalance >= oldBalance, 'balance reduction is not allowed by the award pool');
    holder;
    totalSupply;
    currentBlock;

    return (uint256(newBalance - oldBalance).rayMul(getRate()), false);
  }

  function internalGetReward(address, uint32) internal override returns (uint256) {
    return 0;
  }

  function internalCalcReward(address, uint32) internal view override returns (uint256) {
    return 0;
  }
}
