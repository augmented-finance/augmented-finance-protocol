// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../../../reward/calcs/CalcLinearWeightedReward.sol';
import '../../../reward/pools/ControlledRewardPool.sol';
import '../../../reward/interfaces/IRewardController.sol';
import './PoolTokenBase.sol';

abstract contract RewardedTokenBase is PoolTokenBase, CalcLinearWeightedReward, ControlledRewardPool {
  constructor() ControlledRewardPool(IRewardController(address(0)), 0, 0) {}

  function internalUpdateTotalSupply() internal view override returns (uint256) {
    return super.internalGetTotalSupply();
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return super.getRewardEntry(account).rewardBase;
  }

  function internalSetIncentivesController(address) internal override {
    _mutable();
    _notSupported();
  }

  function _notSupported() private pure {
    revert('UNSUPPORTED');
  }

  function _mutable() private {}

  function addRewardProvider(address, address) external view override onlyConfigAdmin {
    _notSupported();
  }

  function removeRewardProvider(address provider) external override onlyConfigAdmin {}

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 rate) internal override {
    super.setLinearRate(rate);
  }

  function getIncentivesController() public view override returns (address) {
    return address(this);
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalGetReward(address holder, uint256) internal override returns (uint256, uint32) {
    return doGetReward(holder);
  }

  function internalCalcReward(address holder, uint32 at) internal view override returns (uint256, uint32) {
    return doCalcRewardAt(holder, at);
  }

  function getAccessController() internal view override returns (IMarketAccessController) {
    return _pool.getAccessController();
  }

  function internalAllocatedReward(
    address account,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal {
    if (allocated == 0) {
      if (mode == AllocationMode.Push || getRewardController() == address(0)) {
        return;
      }
    }
    super.internalAllocateReward(account, allocated, since, mode);
  }

  function internalIncrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal override {
    (uint256 allocated, uint32 since, AllocationMode mode) = doIncrementRewardBalance(account, amount);
    internalAllocatedReward(account, allocated, since, mode);
  }

  function internalDecrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal override {
    // require(oldAccountBalance >= amount, 'ERC20: burn amount exceeds balance');
    (uint256 allocated, uint32 since, AllocationMode mode) = doDecrementRewardBalance(account, amount);
    internalAllocatedReward(account, allocated, since, mode);
  }

  function internalUpdateTotalSupply(uint256 newSupply) internal override {
    doUpdateTotalSupply(newSupply);
  }

  // function initialize(InitData calldata config) external override {
  //   require
  //   _initialize(config);
  // }

  // function initializedRewardPoolWith() external view override returns (InitData memory) {

  // }
}
