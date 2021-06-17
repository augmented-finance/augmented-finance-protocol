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

  IRewardController internal _controller;
  bool private _paused;

  constructor(IRewardController controller) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
  }

  function updateBaseline(uint256) external virtual override onlyController returns (bool) {
    return false;
  }

  function disableBaseline() external override onlyController {
    internalDisableBaseline();
  }

  function disableRewardPool() external override onlyController {
    internalDisableBaseline();
    internalDisableRate();
  }

  function internalDisableBaseline() internal virtual {}

  function internalDisableRate() internal virtual;

  function setBaselinePercentage(uint16) external virtual override onlyRateController {
    revert('UNSUPPORTED');
  }

  function setRate(uint256) public virtual override onlyRateController {
    revert('UNSUPPORTED');
  }

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

  function internalPause(bool paused) internal virtual;

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
