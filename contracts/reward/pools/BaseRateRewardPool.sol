// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BaseRateRewardPool is ControlledRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint16 private constant NO_BASELINE = type(uint16).max;
  uint16 private _baselinePercentage;
  uint256 private _pausedRate;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public ControlledRewardPool(controller) {
    if (initialRate != 0 && baselinePercentage == 0) {
      _baselinePercentage = NO_BASELINE;
    } else {
      _baselinePercentage = baselinePercentage;
    }
    internalSetRate(initialRate, uint32(block.number));
  }

  function updateBaseline(uint256 baseline) external override onlyController returns (bool) {
    if (_baselinePercentage == NO_BASELINE) {
      return false;
    }
    setRate(baseline.percentMul(_baselinePercentage));
    return true;
  }

  function internalDisableBaseline() internal override {
    _baselinePercentage = NO_BASELINE;
  }

  function internalDisableRate() internal override {
    _pausedRate = 0;
    internalSetRate(0, uint32(block.number));
  }

  function setBaselinePercentage(uint16 factor) external override onlyRateController {
    require(factor <= PercentageMath.ONE, 'illegal value');
    _baselinePercentage = factor;
  }

  function setRate(uint256 rate) public override onlyRateController {
    if (isPaused()) {
      _pausedRate = rate;
      return;
    }
    internalSetRate(rate, uint32(block.number));
  }

  function internalSetRate(uint256 rate, uint32 currentBlock) internal virtual;

  function getRate() public view virtual returns (uint256);

  function internalPause(bool paused) internal override {
    if (paused) {
      _pausedRate = getRate();
      internalSetRate(0, uint32(block.number));
      return;
    }
    internalSetRate(_pausedRate, uint32(block.number));
  }
}
