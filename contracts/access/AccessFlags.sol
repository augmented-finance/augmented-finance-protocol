// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

library AccessFlags {
  bytes32 public constant EMERGENCY_ADMIN = 'EMERGENCY_ADMIN';

  // Following constants are used by descendant(s)
  uint256 public constant ACL_AGF_MINT = 1 << 1;
  uint256 public constant ACL_AGF_BURN = 1 << 2;
  uint256 public constant ACL_AGF_SUSPEND_ADDRESS = 1 << 3;

  bytes32 public constant LENDING_POOL = 'LENDING_POOL';
  bytes32 public constant LENDING_POOL_CONFIGURATOR = 'LENDING_POOL_CONFIGURATOR';
  bytes32 public constant POOL_ADMIN = 'POOL_ADMIN';
  bytes32 public constant LENDING_POOL_COLLATERAL_MANAGER = 'COLLATERAL_MANAGER';
  bytes32 public constant PRICE_ORACLE = 'PRICE_ORACLE';
  bytes32 public constant LENDING_RATE_ORACLE = 'LENDING_RATE_ORACLE';
}
