// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IProxy {
  function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}
