// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {IRewardPool} from '../interfaces/IRewardPool.sol';
import {BaseRateRewardPool} from './BaseRateRewardPool.sol';

import 'hardhat/console.sol';

abstract contract MonoProviderRewardPool is BaseRateRewardPool, IRewardPool {
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
    uint256 newSupply
  ) external override {
    require(_provider == msg.sender, 'unknown reward provider');

    if (newSupply == 0) {
      newSupply = 1;
    }

    (uint256 allocated, uint32 since, bool newcomer) =
      internalUpdateReward(
        msg.sender,
        holder,
        oldBalance,
        newBalance,
        newSupply,
        uint32(block.number)
      );
    internalAllocateReward(holder, allocated, since, newcomer, newBalance);
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

  function internalUpdateReward(
    address provider,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 since,
      bool newcomer
    );
}
