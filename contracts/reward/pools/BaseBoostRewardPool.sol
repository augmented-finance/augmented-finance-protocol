// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';
import {IForwardedRewardPool} from '../interfaces/IForwardedRewardPool.sol';
import {IForwardingRewardPool} from '../interfaces/IForwardingRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BaseBoostRewardPool is ControlledRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint224 rateScale,
    uint16 baselinePercentage
  ) public ControlledRewardPool(controller, initialRate, rateScale, baselinePercentage) {}

  function addRewardProvider(address, address) external override onlyController {
    revert('UNSUPPORTED');
  }

  function removeRewardProvider(address) external override onlyController {}
}
