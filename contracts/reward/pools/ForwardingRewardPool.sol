// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';
import {IForwardedRewardPool} from '../interfaces/IForwardedRewardPool.sol';
import {IForwardingRewardPool} from '../interfaces/IForwardingRewardPool.sol';
import {IBoostExcessReceiver} from '../interfaces/IBoostExcessReceiver.sol';

import 'hardhat/console.sol';

contract ForwardingRewardPool is IForwardingRewardPool, IBoostExcessReceiver, ControlledRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  IForwardedRewardPool private _provider;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public ControlledRewardPool(controller, initialRate, baselinePercentage) {}

  function addRewardProvider(address provider, address) external virtual override onlyController {
    require(provider != address(0), 'provider is required');
    require(_provider == IForwardedRewardPool(0), 'provider is already set');
    _provider = IForwardedRewardPool(provider);

    if (isPaused()) {
      _provider.setRewardRate(0);
    } else {
      _provider.setRewardRate(_pausedRate);
    }
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    if (address(_provider) != provider || provider == address(0)) {
      return;
    }
    _pausedRate = uint224(_provider.getRewardRate());
    _provider = IForwardedRewardPool(0);
  }

  function getRate() public view override returns (uint256) {
    if (_provider != IForwardedRewardPool(0)) {
      return _provider.getRewardRate();
    }
    if (isPaused()) {
      return 0;
    }
    return _pausedRate;
  }

  function internalSetRate(uint256 rate) internal override {
    if (_provider != IForwardedRewardPool(0)) {
      _provider.setRewardRate(rate);
      return;
    }
    _pausedRate = uint224(rate);
  }

  function internalCalcReward(address holder) internal view override returns (uint256, uint32) {
    if (_provider != IForwardedRewardPool(0)) {
      return _provider.calcReward(holder);
    }
    return (0, 0);
  }

  function internalGetReward(address holder) internal override returns (uint256, uint32) {
    if (_provider != IForwardedRewardPool(0)) {
      return _provider.claimReward(holder);
    }
    return (0, 0);
  }

  function allocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) external override {
    require(msg.sender == address(_provider), 'unknown provider');
    internalAllocateReward(holder, allocated, since, mode);
  }

  function receiveBoostExcess(uint256 amount, uint32 since) external override onlyController {
    IBoostExcessReceiver(address(_provider)).receiveBoostExcess(amount, since);
  }
}
