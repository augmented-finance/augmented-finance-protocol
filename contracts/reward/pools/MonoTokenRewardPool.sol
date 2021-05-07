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

abstract contract MonoTokenRewardPool is BaseRateRewardPool, IRewardPool {
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
    require(token != address(0) && token == _token, 'unsupported token');

    uint256 oldSupply = _providers[msg.sender];
    require(oldSupply > 0, 'unknown reward provider');

    if (newSupply == 0) {
      newSupply = 1;
    }
    if (internalUpdateTotalSupply(msg.sender, oldSupply, newSupply, uint32(block.number))) {
      _providers[msg.sender] = newSupply;
    }

    (uint256 allocated, uint32 since, AllocationMode mode) =
      internalUpdateReward(
        msg.sender,
        holder,
        oldBalance,
        newBalance,
        newSupply,
        uint32(block.number)
      );

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
    uint256 providerBalance = _providers[provider];
    if (providerBalance > 0) {
      return;
    }
    _providers[provider] = 1;
    internalUpdateTotalSupply(provider, 0, 1, uint32(block.number));
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    uint256 providerBalance = _providers[provider];
    if (providerBalance == 0) {
      return;
    }
    internalUpdateTotalSupply(provider, providerBalance, 0, uint32(block.number));
    delete (_providers[provider]);
  }

  function internalUpdateTotalSupply(
    address provider,
    uint256 oldSupply,
    uint256 newSupply,
    uint32 currentBlock
  ) internal virtual returns (bool);

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
      AllocationMode mode
    );
}
