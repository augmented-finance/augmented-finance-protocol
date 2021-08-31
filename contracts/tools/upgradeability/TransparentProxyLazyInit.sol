// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../dependencies/openzeppelin/upgradeability/BaseUpgradeabilityProxy.sol';
import './TransparentProxyBase.sol';

/// @dev This contract is a transparent upgradeability proxy with admin. The admin role is immutable.
contract TransparentProxyLazyInit is TransparentProxyBase {
  constructor(address admin) TransparentProxyBase(admin) {}

  /// @dev Sets initial implementation of the proxy and call a function on it. Can be called only once, but by anyone.
  /// @dev Caller MUST check return to be equal to proxy's address to ensure that this function was actually called.
  function initializeProxy(address logic, bytes calldata data) external returns (address self) {
    if (_implementation() == address(0)) {
      _upgradeTo(logic);
      Address.functionDelegateCall(logic, data);
      return address(this); // call sanity check
    } else {
      _fallback();
    }
  }
}
