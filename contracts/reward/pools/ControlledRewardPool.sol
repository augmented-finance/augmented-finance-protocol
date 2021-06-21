// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IManagedRewardPool.sol';

import 'hardhat/console.sol';

abstract contract ControlledRewardPool is IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint16 internal constant NO_BASELINE = type(uint16).max;

  IRewardController internal _controller;

  uint224 internal _pausedRate;
  uint16 private _baselinePercentage;
  bool private _paused;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;

    require(initialRate <= type(uint224).max, 'excessive initialRate value');

    if (initialRate != 0 && baselinePercentage == 0) {
      _baselinePercentage = NO_BASELINE;
    } else {
      _baselinePercentage = baselinePercentage;
    }

    internalSetRate(uint224(initialRate));
  }

  function updateBaseline(uint256 baseline)
    external
    virtual
    override
    onlyController
    returns (bool)
  {
    if (_baselinePercentage == NO_BASELINE) {
      return false;
    }
    setRate(baseline.percentMul(_baselinePercentage));
    return true;
  }

  function disableBaseline() external override onlyController {
    _baselinePercentage = NO_BASELINE;
  }

  function disableRewardPool() external override onlyController {
    _baselinePercentage = NO_BASELINE;
    _pausedRate = 0;
    internalSetRate(0);
  }

  //  function internalDisableBaseline() internal virtual {}

  //  function internalDisableRate() internal virtual;

  function setBaselinePercentage(uint16 factor) external override onlyRateController {
    internalSetBaselinePercentage(factor);
  }

  function internalSetBaselinePercentage(uint16 factor) internal virtual {
    require(factor <= PercentageMath.ONE, 'illegal value');
    _baselinePercentage = factor;
  }

  function setRate(uint256 rate) public virtual override onlyRateController {
    require(rate <= type(uint224).max, 'excessive rate value');

    if (isPaused()) {
      _pausedRate = uint224(rate);
      return;
    }
    internalSetRate(rate);
  }

  function getRate() public view virtual returns (uint256);

  function internalSetRate(uint256 rate) internal virtual;

  function setPaused(bool paused) public override onlyEmergencyAdmin {
    if (_paused == paused) {
      return;
    }
    _paused = paused;
    internalPause(paused);
  }

  function isPaused() public view override returns (bool) {
    return _paused;
  }

  function internalPause(bool paused) internal virtual {
    if (paused) {
      _pausedRate = uint224(getRate());
      internalSetRate(0);
      return;
    }
    internalSetRate(_pausedRate);
  }

  function getRewardController() public view override returns (address) {
    return address(_controller);
  }

  function claimRewardFor(address holder)
    external
    override
    onlyController
    returns (uint256, uint32)
  {
    return internalGetReward(holder);
  }

  function calcRewardFor(address holder) external view override returns (uint256, uint32) {
    return internalCalcReward(holder);
  }

  function internalAllocateReward(
    address holder,
    uint256 allocated,
    uint32 sinceBlock, // must block, not TS
    AllocationMode mode
  ) internal {
    _controller.allocatedByPool(holder, allocated, sinceBlock, mode);
  }

  function internalGetReward(address holder) internal virtual returns (uint256, uint32);

  function internalCalcReward(address holder) internal view virtual returns (uint256, uint32);

  function isController(address addr) internal view returns (bool) {
    return address(_controller) == addr || _controller.isConfigurator(addr);
  }

  modifier onlyController() {
    require(isController(msg.sender), 'only controller is allowed');
    _;
  }

  modifier onlyRateController() {
    require(_controller.isRateController(msg.sender), 'only rate controller is allowed');
    _;
  }

  modifier onlyEmergencyAdmin() {
    require(_controller.isEmergencyAdmin(msg.sender), 'only emergency admin is allowed');
    _;
  }

  modifier notPaused() {
    require(!_paused, 'rewards are paused');
    _;
  }
}
