// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IManagedRewardPool.sol';
import {AccessFlags} from '../../access/AccessFlags.sol';
import {AccessHelper} from '../../access/AccessHelper.sol';

import 'hardhat/console.sol';

abstract contract ControlledRewardPool is IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint16 internal constant NO_BASELINE = type(uint16).max;
  uint224 internal constant NO_SCALE = 1e27; // WadRayMath.RAY

  IRewardController internal _controller;

  uint256 internal _pausedRate;
  uint224 internal _rateScale;
  uint16 private _baselinePercentage;
  bool private _paused;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint224 rateScale,
    uint16 baselinePercentage
  ) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;

    if (initialRate != 0 && baselinePercentage == 0) {
      _baselinePercentage = NO_BASELINE;
    } else {
      _baselinePercentage = baselinePercentage;
    }

    internalSetRateScale(rateScale);
    internalSetRate(initialRate);
  }

  function updateBaseline(uint256 baseline)
    external
    virtual
    override
    onlyController
    returns (bool hasBaseline, uint256 appliedRate)
  {
    if (_baselinePercentage == NO_BASELINE) {
      return (false, internalGetRate().rayDiv(_rateScale));
    }
    appliedRate = baseline.percentMul(_baselinePercentage);
    _setRate(appliedRate);
    return (true, appliedRate);
  }

  function disableBaseline() external override onlyController {
    _baselinePercentage = NO_BASELINE;
  }

  function disableRewardPool() external override onlyController {
    _baselinePercentage = NO_BASELINE;
    _pausedRate = 0;
    internalSetRate(0);
  }

  function setBaselinePercentage(uint16 factor) external override onlyRateController {
    internalSetBaselinePercentage(factor);
  }

  function internalSetBaselinePercentage(uint16 factor) internal virtual {
    require(factor <= PercentageMath.ONE, 'illegal value');
    _baselinePercentage = factor;
  }

  function setRate(uint256 rate) external override onlyRateController {
    _setRate(rate);
  }

  function _setRate(uint256 rate) private {
    if (isPaused()) {
      _pausedRate = rate;
      return;
    }
    internalSetRate(rate.rayMul(_rateScale));
  }

  function scaleRate(uint256 rate) internal view returns (uint256) {
    return rate.rayMul(_rateScale);
  }

  function getRate() external view returns (uint256) {
    return internalGetRate().rayDiv(_rateScale);
  }

  function internalSetRateScale(uint256 rateScale) private {
    require(rateScale > 0, 'rate scale is required');
    require(rateScale <= type(uint224).max, 'rate scale is excessive');
    _rateScale = uint224(rateScale);
  }

  function setRateScale(uint256 rateScale) external override onlyRateController {
    internalSetRateScale(rateScale);
  }

  function getRateScale() external view returns (uint256) {
    return _rateScale;
  }

  function internalGetRate() internal view virtual returns (uint256);

  function internalSetRate(uint256 rate) internal virtual;

  function setPaused(bool paused) public override onlyEmergencyAdmin {
    if (_paused != paused) {
      _paused = paused;
      internalPause(paused);
    }
    emit EmergencyPaused(msg.sender, paused);
  }

  function isPaused() public view override returns (bool) {
    return _paused;
  }

  function internalPause(bool paused) internal virtual {
    if (paused) {
      _pausedRate = internalGetRate();
      internalSetRate(0);
      return;
    }
    internalSetRate(_pausedRate);
  }

  function getRewardController() public view override returns (address) {
    return address(_controller);
  }

  function claimRewardFor(address holder, uint256 limit)
    external
    override
    onlyController
    returns (uint256, uint32)
  {
    return internalGetReward(holder, limit);
  }

  function calcRewardFor(address holder) external view override returns (uint256, uint32) {
    return internalCalcReward(holder);
  }

  function internalAllocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal {
    _controller.allocatedByPool(holder, allocated, since, mode);
  }

  function internalGetReward(address holder, uint256 limit)
    internal
    virtual
    returns (uint256, uint32);

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

  modifier onlyRefAdmin() {
    require(
      AccessHelper.hasAllOf(
        _controller.getAccessController(),
        msg.sender,
        AccessFlags.REFERRAL_ADMIN
      ),
      'only referral admin is allowed'
    );
    _;
  }

  modifier notPaused() {
    require(!_paused, 'rewards are paused');
    _;
  }
}
