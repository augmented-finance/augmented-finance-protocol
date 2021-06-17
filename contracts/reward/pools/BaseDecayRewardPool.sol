// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IDecayRewardPool} from '../interfaces/IDecayRewardPool.sol';
import {BaseRateRewardPool} from './BaseRateRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BaseDecayRewardPool is BaseRateRewardPool, IDecayRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  address private _provider;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public BaseRateRewardPool(controller, initialRate, baselinePercentage) {}

  function handleDecayBalanceUpdate(
    address holder,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 decayPeriod
  ) external override {
    internalUpdateTotal(totalSupply, 0, 0, 0);
    _handleBalanceUpdate(holder, newBalance, decayPeriod);
  }

  function handleDecayTotalUpdate(
    uint256 totalSupply,
    uint256 totalDecay,
    uint32 decayPeriod,
    uint32 updatedAt
  ) external virtual override {
    internalUpdateTotal(totalSupply, totalDecay, decayPeriod, updatedAt);
  }

  function _handleBalanceUpdate(
    address holder,
    uint256 newBalance,
    uint32 decayPeriod
  ) private {
    require(_provider == msg.sender, 'unknown reward provider');

    (uint256 allocated, uint32 since, AllocationMode mode) =
      internalUpdateReward(holder, newBalance, decayPeriod);
    internalAllocateReward(holder, allocated, since, mode);
  }

  function addRewardProvider(address provider, address) external virtual override onlyController {
    require(provider != address(0), 'provider is required');
    require(_provider == address(0), 'provider is already set');
    _provider = provider;
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    if (_provider != provider) {
      return;
    }
    _provider = address(0);
  }

  function internalUpdateTotal(
    uint256 totalBalance,
    uint256 totalDecay,
    uint32 decayPeriod,
    uint32 updatedAt
  ) internal virtual;

  function internalUpdateReward(
    address holder,
    uint256 newBalance,
    uint32 decayPeriod
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 sinceBlock,
      AllocationMode mode
    );
}
