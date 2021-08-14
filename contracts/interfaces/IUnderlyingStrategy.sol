// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IUnderlyingStrategy {
  function getUnderlying(address asset) external view returns (address);

  function delegatedWithdrawUnderlying(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);
}
