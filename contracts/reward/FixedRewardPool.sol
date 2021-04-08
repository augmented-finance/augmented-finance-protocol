// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {Aclable} from '../misc/Aclable.sol';
import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';
import {BasicRewardPool} from './BasicRewardPool.sol';

import 'hardhat/console.sol';

abstract contract FixedRewardPool is BasicRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  // function internalUpdateReward(address holder, uint256 rewardBase, uint32 currentBlock) internal virtual returns (uint256);
  // function internalGetReward(address holder, uint32 currentBlock) internal virtual returns (uint256);
  // function internalCalcReward(address holder, uint32 currentBlock) internal virtual view returns (uint256);
}
