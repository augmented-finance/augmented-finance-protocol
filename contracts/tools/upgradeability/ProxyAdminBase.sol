// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import './IProxy.sol';

/**
 * @dev This is an auxiliary contract meant to be assigned as the admin of a {IProxy}. For an
 * explanation of why you would want to use this see the documentation for {IProxy}.
 * @author Adopted from the OpenZeppelin
 */
abstract contract ProxyAdminBase {
  /**
   * @dev Returns the current implementation of `proxy`.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function _getProxyImplementation(IProxy proxy) internal view returns (address) {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("implementation()")) == 0x5c60da1b
    (bool success, bytes memory returndata) = address(proxy).staticcall(hex'5c60da1b');
    require(success);
    return abi.decode(returndata, (address));
  }

  /**
   * @dev Returns the current admin of `proxy`.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function _getProxyAdmin(IProxy proxy) internal view returns (address) {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("admin()")) == 0xf851a440
    (bool success, bytes memory returndata) = address(proxy).staticcall(hex'f851a440');
    require(success);
    return abi.decode(returndata, (address));
  }
}
