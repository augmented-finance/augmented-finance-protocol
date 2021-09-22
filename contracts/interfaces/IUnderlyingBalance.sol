// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IUnderlyingBalance {
  /// @dev Returns amount of underlying for the given address
  function balanceOfUnderlying(address account) external view returns (uint256);
}

interface ILockedUnderlyingBalance is IUnderlyingBalance {
  /// @dev Returns amount of underlying and a timestamp when the lock expires. Funds can be redeemed after the timestamp.
  function balanceOfUnderlyingAndExpiry(address account)
    external
    view
    returns (uint256 underlying, uint32 availableSince);
}
