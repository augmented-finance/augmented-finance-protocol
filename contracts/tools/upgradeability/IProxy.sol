// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IProxy {
  function admin() external returns (address);

  function implementation() external returns (address);

  function upgradeTo(address newImplementation) external;

  function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}
