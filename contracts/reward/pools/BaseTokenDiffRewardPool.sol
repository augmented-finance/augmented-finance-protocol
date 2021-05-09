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

abstract contract BaseTokenDiffRewardPool is BaseRateRewardPool, IRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  // provider => provider_balance
  mapping(address => uint256) private _providers;
  address private _token;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address token
  ) public BaseRateRewardPool(controller, initialRate, baselinePercentage) {
    _token = token;
  }

  function handleBalanceUpdate(
    address token,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newSupply
  ) external override {
    _handleBalanceUpdate(token, holder, oldBalance, newBalance, newSupply);
  }

  function handleScaledBalanceUpdate(
    address token,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newSupply,
    uint256 scaleRay
  ) external override {
    _handleBalanceUpdate(
      token,
      holder,
      oldBalance.rayMul(scaleRay),
      newBalance.rayMul(scaleRay),
      newSupply.rayMul(scaleRay)
    );
  }

  function _handleBalanceUpdate(
    address token,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newSupply
  ) private {
    require(token != address(0) && token == _token, 'unsupported token');

    uint256 oldSupply = _providers[msg.sender];
    require(oldSupply != 0, 'unknown reward provider');

    if (newSupply == 0) {
      newSupply = 1;
    }

    internalUpdateSupplyDiff(oldSupply, newSupply, uint32(block.number));

    (uint256 allocated, uint32 since, AllocationMode mode) =
      internalUpdateReward(msg.sender, holder, oldBalance, newBalance, uint32(block.number));

    internalAllocateReward(holder, allocated, since, mode);
  }

  function addRewardProvider(address provider, address token)
    external
    virtual
    override
    onlyController
  {
    require(provider != address(0), 'provider is required');
    if (_token == address(0)) {
      require(token != address(0), 'token is required');
      _token = token;
    } else {
      require(token != _token, 'token is different');
    }
    if (_providers[provider] != 0) {
      return;
    }
    _providers[provider] = 1;
    internalUpdateSupplyDiff(0, 1, uint32(block.number));
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    uint256 oldSupply = _providers[provider];
    if (oldSupply == 0) {
      return;
    }
    delete (_providers[provider]);
    internalUpdateSupplyDiff(oldSupply, 0, uint32(block.number));
  }

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

  function internalUpdateSupplyDiff(
    uint256 oldSupply,
    uint256 newSupply,
    uint32 currentBlock
  ) internal virtual;
}
