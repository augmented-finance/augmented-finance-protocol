// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IRewardPool} from '../interfaces/IRewardPool.sol';
import {BaseRateRewardPool} from './BaseRateRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BaseTokenAbsRewardPool is BaseRateRewardPool, IRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  address private _provider;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public BaseRateRewardPool(controller, initialRate, baselinePercentage) {}

  function handleBalanceUpdate(
    address,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalBalance
  ) external override {
    internalUpdateTotal(totalBalance, uint32(block.number));
    _handleBalanceUpdate(holder, oldBalance, newBalance, uint32(block.number));
  }

  function handleScaledBalanceUpdate(
    address,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalBalance,
    uint256
  ) external virtual override {
    // NB! as we have only one provider - scaling matters not
    internalUpdateTotal(totalBalance, uint32(block.number));
    _handleBalanceUpdate(holder, oldBalance, newBalance, uint32(block.number));
  }

  function isScaledBalanceUpdateNeeded() external view override returns (bool) {
    // NB! as we have only one provider - scaling matters not
    return false;
  }

  function _handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint32 blockNumber
  ) private {
    require(_provider == msg.sender, 'unknown reward provider');

    (uint256 allocated, uint32 since, AllocationMode mode) =
      internalUpdateReward(msg.sender, holder, oldBalance, newBalance, blockNumber);
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

  function internalUpdateTotal(uint256 totalBalance, uint32 currentBlock) internal virtual;

  function internalUpdateReward(
    address provider,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint32 currentBlock
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 since,
      AllocationMode mode
    );
}
