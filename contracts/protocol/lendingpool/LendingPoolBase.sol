// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../access/interfaces/IMarketAccessController.sol';
import '../../access/AccessHelper.sol';
import '../../access/AccessFlags.sol';
import '../../tools/Errors.sol';
import './LendingPoolStorage.sol';

abstract contract LendingPoolBase is LendingPoolStorage {
  using AccessHelper for IMarketAccessController;

  function _whenNotPaused() private view {
    require(!_paused, Errors.LP_IS_PAUSED);
  }

  modifier whenNotPaused() {
    _whenNotPaused();
    _;
  }

  function _onlyLendingPoolConfigurator() private view {
    _addressesProvider.requireAnyOf(msg.sender, AccessFlags.LENDING_POOL_CONFIGURATOR,
      Errors.LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR
    );
  }

  modifier onlyLendingPoolConfigurator() {
    // This trick makes generated code smaller when modifier is applied multiple times.
    _onlyLendingPoolConfigurator();
    _;
  }

  function _onlyConfiguratorOrAdmin() private view {
    _addressesProvider.requireAnyOf(
      msg.sender,
      AccessFlags.POOL_ADMIN | AccessFlags.LENDING_POOL_CONFIGURATOR,
      Errors.CALLER_NOT_POOL_ADMIN
    );
  }

  modifier onlyConfiguratorOrAdmin() {
    _onlyConfiguratorOrAdmin();
    _;
  }

  function _notNestedCall() private view {
    require(_nestedCalls == 0, Errors.LP_TOO_MANY_NESTED_CALLS);
  }

  modifier noReentry {
    _notNestedCall();
    _nestedCalls++;
    _;
    _nestedCalls--;
  }

  modifier noReentryOrFlashloan {
    require(_flashloanCalls == 0, Errors.LP_TOO_MANY_FLASHLOAN_CALLS);
    _notNestedCall();
    _nestedCalls++;
    _;
    _nestedCalls--;
  }
}
