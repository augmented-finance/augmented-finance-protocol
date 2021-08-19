// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardController.sol';
import '../interfaces/IRewardPool.sol';
import './ControlledRewardPool.sol';

abstract contract BaseTokenAbsRewardPool is ControlledRewardPool, IRewardPool {
  address private _provider;

  function handleBalanceUpdate(
    address,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalBalance
  ) external override {
    internalUpdateTotal(totalBalance);
    _handleBalanceUpdate(holder, oldBalance, newBalance);
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
    internalUpdateTotal(totalBalance);
    _handleBalanceUpdate(holder, oldBalance, newBalance);
  }

  function isScaledBalanceUpdateNeeded() external pure override returns (bool) {
    // NB! as we have only one provider - scaling matters not
    return false;
  }

  function _handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance
  ) private {
    require(_provider == msg.sender, 'unknown reward provider');

    (uint256 allocated, uint32 since, AllocationMode mode) = internalUpdateReward(
      msg.sender,
      holder,
      oldBalance,
      newBalance
    );
    internalAllocateReward(holder, allocated, since, mode);
  }

  function addRewardProvider(address provider, address token) external virtual override onlyConfigAdmin {
    require(provider != address(0), 'provider is required');
    require(_provider == address(0), 'provider is already set');
    _provider = provider;
    emit ProviderAdded(provider, token);
  }

  function removeRewardProvider(address provider) external virtual override onlyConfigAdmin {
    if (_provider != provider || provider == address(0)) {
      return;
    }
    _provider = address(0);
    emit ProviderRemoved(provider);
  }

  function internalUpdateTotal(uint256 totalBalance) internal virtual;

  function internalUpdateReward(
    address provider,
    address holder,
    uint256 oldBalance,
    uint256 newBalance
  )
    internal
    virtual
    returns (
      uint256 allocated,
      uint32 sinceBlock,
      AllocationMode mode
    );
}
