// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/PercentageMath.sol';
import '../interfaces/IRewardController.sol';
import '../interfaces/IManagedRewardPool.sol';
import '../../access/AccessFlags.sol';
import '../../access/AccessHelper.sol';
import '../../tools/Errors.sol';

abstract contract ControlledRewardPool is IManagedRewardPool {
  using PercentageMath for uint256;

  IRewardController private _controller;

  uint16 private _baselinePercentage;
  bool private _paused;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) {
    _initialize(controller, initialRate, baselinePercentage, '');
  }

  function _initialize(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    string memory poolName
  ) internal virtual {
    poolName;
    _controller = controller;

    if (baselinePercentage > 0) {
      _setBaselinePercentage(baselinePercentage);
    }

    if (initialRate > 0) {
      _setRate(initialRate);
    }
  }

  function getPoolName() public view virtual override returns (string memory) {
    return '';
  }

  function updateBaseline(uint256 baseline)
    external
    virtual
    override
    onlyController
    returns (bool hasBaseline, uint256 appliedRate)
  {
    if (_baselinePercentage == 0) {
      return (false, internalGetRate());
    }
    appliedRate = baseline.percentMul(_baselinePercentage);
    _setRate(appliedRate);
    return (true, appliedRate);
  }

  function setBaselinePercentage(uint16 factor) external override onlyController {
    _setBaselinePercentage(factor);
  }

  function getBaselinePercentage() public view override returns (uint16) {
    return _baselinePercentage;
  }

  function _mustHaveController() private view {
    require(address(_controller) != address(0), 'controller is required');
  }

  function _setBaselinePercentage(uint16 factor) internal virtual {
    _mustHaveController();
    if (factor == 0) {
      // ATTN! This line was added after mainnet deploy and is NOT present in the original pools
      _setRate(0);
    } else {
      require(factor <= PercentageMath.ONE, 'illegal value');
    }
    _baselinePercentage = factor;
    emit BaselinePercentageUpdated(factor);
  }

  function _setRate(uint256 rate) internal {
    _mustHaveController();
    internalSetRate(rate);
    emit RateUpdated(rate);
  }

  function getRate() external view override returns (uint256) {
    return internalGetRate();
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

  function internalPause(bool paused) internal virtual {}

  function getRewardController() public view override returns (address) {
    return address(_controller);
  }

  function claimRewardFor(address holder)
    external
    override
    onlyController
    returns (
      uint256,
      uint32,
      bool
    )
  {
    return internalGetReward(holder);
  }

  function claimRewardWithLimitFor(
    address holder,
    uint256 baseAmount,
    uint256 limit,
    uint16 minPct
  )
    external
    override
    onlyController
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull,
      uint256 newLimit
    )
  {
    return internalGetRewardWithLimit(holder, baseAmount, limit, minPct);
  }

  function calcRewardFor(address holder, uint32 at)
    external
    view
    virtual
    override
    returns (
      uint256 amount,
      uint256,
      uint32 since
    )
  {
    require(at >= uint32(block.timestamp));
    (amount, since) = internalCalcReward(holder, at);
    return (amount, 0, since);
  }

  function internalAllocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal {
    _controller.allocatedByPool(holder, allocated, since, mode);
  }

  function internalGetRewardWithLimit(
    address holder,
    uint256 baseAmount,
    uint256 limit,
    uint16 minBoostPct
  )
    internal
    virtual
    returns (
      uint256 amount,
      uint32 since,
      bool keepPull,
      uint256
    )
  {
    (amount, since, keepPull) = internalGetReward(holder);
    amount += baseAmount;
    if (minBoostPct > 0) {
      limit += PercentageMath.percentMul(amount, minBoostPct);
    }
    return (amount, since, keepPull, limit);
  }

  function internalGetReward(address holder)
    internal
    virtual
    returns (
      uint256,
      uint32,
      bool
    );

  function internalCalcReward(address holder, uint32 at) internal view virtual returns (uint256, uint32);

  function attachedToRewardController() external override onlyController returns (uint256) {
    internalAttachedToRewardController();
    return internalGetPreAllocatedLimit();
  }

  function detachedFromRewardController() external override onlyController returns (uint256) {
    return internalGetPreAllocatedLimit();
  }

  function internalGetPreAllocatedLimit() internal virtual returns (uint256) {
    return 0;
  }

  function internalAttachedToRewardController() internal virtual {}

  function _isController(address addr) internal view virtual returns (bool) {
    return address(_controller) == addr;
  }

  function getAccessController() internal view virtual returns (IMarketAccessController) {
    return _controller.getAccessController();
  }

  function _onlyController() private view {
    require(_isController(msg.sender), Errors.CALLER_NOT_REWARD_CONTROLLER);
  }

  modifier onlyController() {
    _onlyController();
    _;
  }

  function _isConfigAdmin(address addr) internal view returns (bool) {
    return address(_controller) != address(0) && _controller.isConfigAdmin(addr);
  }

  function _onlyConfigAdmin() private view {
    require(_isConfigAdmin(msg.sender), Errors.CALLER_NOT_REWARD_CONFIG_ADMIN);
  }

  modifier onlyConfigAdmin() {
    _onlyConfigAdmin();
    _;
  }

  function _isRateAdmin(address addr) internal view returns (bool) {
    return address(_controller) != address(0) && _controller.isRateAdmin(addr);
  }

  function _onlyRateAdmin() private view {
    require(_isRateAdmin(msg.sender), Errors.CALLER_NOT_REWARD_RATE_ADMIN);
  }

  modifier onlyRateAdmin() {
    _onlyRateAdmin();
    _;
  }

  function _onlyEmergencyAdmin() private view {
    AccessHelper.requireAnyOf(
      getAccessController(),
      msg.sender,
      AccessFlags.EMERGENCY_ADMIN,
      Errors.CALLER_NOT_EMERGENCY_ADMIN
    );
  }

  modifier onlyEmergencyAdmin() {
    _onlyEmergencyAdmin();
    _;
  }

  function _notPaused() private view {
    require(!_paused, Errors.RW_REWARD_PAUSED);
  }

  modifier notPaused() {
    _notPaused();
    _;
  }

  modifier notPausedCustom(string memory err) {
    require(!_paused, err);
    _;
  }
}
