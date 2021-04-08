// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {IRewardController} from './IRewardController.sol';
import {BasicRewardPool} from './BasicRewardPool.sol';

import 'hardhat/console.sol';

contract FixedRewardPool is BasicRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _rate;

  constructor(IRewardController controller) public BasicRewardPool(controller) {}

  function isLazy() external view override returns (bool) {
    return false;
  }

  function internalSetRate(uint256 rate, uint32) internal override {
    _rate = rate;
  }

  function internalGetRate() internal view override returns (uint256) {
    return _rate;
  }

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal override returns (uint256) {
    require(newBalance >= oldBalance, 'balance reduction is not allowed by the award pool');
    holder;
    totalSupply;

    if (isCutOff(currentBlock)) {
      return 0;
    }

    return uint256(newBalance - oldBalance).rayMul(_rate);
  }

  function internalGetReward(address, uint32) internal override returns (uint256) {
    return 0;
  }

  function internalCalcReward(address, uint32) internal view override returns (uint256) {
    return 0;
  }
}
