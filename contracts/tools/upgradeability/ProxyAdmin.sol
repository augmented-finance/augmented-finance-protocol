// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IProxy.sol';
import './ProxyAdminBase.sol';
import '../Errors.sol';

/// @dev This contract meant to be assigned as the admin of a {IProxy}. Adopted from the OpenZeppelin
contract ProxyAdmin is ProxyAdminBase {
  address private immutable _owner;

  constructor() {
    _owner = msg.sender;
  }

  /// @dev Returns the address of the current owner.
  function owner() public view returns (address) {
    return _owner;
  }

  /// @dev Throws if called by any account other than the owner.
  modifier onlyOwner() {
    require(_owner == msg.sender, Errors.TXT_CALLER_NOT_PROXY_OWNER);
    _;
  }

  /// @dev Returns the current implementation of `proxy`.
  function getProxyImplementation(IProxy proxy) public view virtual returns (address) {
    return _getProxyImplementation(proxy);
  }

  /// @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation.
  function upgradeAndCall(
    IProxy proxy,
    address implementation,
    bytes memory data
  ) public payable virtual onlyOwner {
    proxy.upgradeToAndCall{value: msg.value}(implementation, data);
  }
}
