// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardController.sol';
import '../calcs/CalcLinearRewardAccum.sol';
import './ControlledRewardPool.sol';

contract TreasuryRewardPool is ControlledRewardPool, CalcLinearRewardAccum {
  address private _treasury;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) ControlledRewardPool(controller, initialRate, baselinePercentage) {}

  function internalAttachedToRewardController() internal override {
    subscribeTreasury();
  }

  function getTreasury() internal view virtual returns (address) {
    return getAccessController().getAddress(AccessFlags.TREASURY);
  }

  function subscribeTreasury() private {
    address treasury = getTreasury();
    if (_treasury == treasury) {
      return;
    }

    _treasury = treasury;
    if (treasury != address(0)) {
      uint256 allocated = doGetAllReward(type(uint256).max);
      internalAllocateReward(treasury, allocated, uint32(block.timestamp), AllocationMode.SetPullSpecial);
    }
  }

  function internalSetRate(uint256 rate) internal override {
    super.setLinearRate(rate);
  }

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalGetReward(address holder)
    internal
    virtual
    override
    returns (
      uint256,
      uint32,
      bool
    )
  {
    if (holder != address(0) && holder == _treasury) {
      return (doGetAllReward(type(uint256).max), uint32(block.timestamp), true);
    }
    return (0, 0, false);
  }

  function internalCalcReward(address holder, uint32 at) internal view virtual override returns (uint256, uint32) {
    if (holder != address(0) && holder == _treasury) {
      return (doCalcRewardAt(at), at);
    }
    return (0, 0);
  }

  function addRewardProvider(address, address) external view override onlyConfigAdmin {
    revert('UNSUPPORTED');
  }

  function removeRewardProvider(address) external override onlyConfigAdmin {}

  function getPoolName() public pure override returns (string memory) {
    return 'TreasuryPool';
  }
}
