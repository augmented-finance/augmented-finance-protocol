// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

library AccessFlags {
  // various admins & managers - use range [0..15]
  // these roles can be assigned to multiple addresses

  uint256 public constant EMERGENCY_ADMIN = 1 << 0;
  uint256 public constant POOL_ADMIN = 1 << 1;
  uint256 public constant TREASURY_ADMIN = 1 << 2;
  uint256 public constant REWARD_CONFIG_ADMIN = 1 << 3;
  uint256 public constant REWARD_RATE_ADMIN = 1 << 4;
  uint256 public constant STAKE_ADMIN = 1 << 5;

  uint256 public constant LIQUIDITY_CONTROLLER = 1 << 15; // can slash & pause stakes

  // singletons - use range [16..32]
  // these roles can ONLY be assigned to a single address
  uint256 public constant SINGLETONS = ((uint256(1) << 32) - 1) & ~((uint256(1) << 16) - 1);

  uint256 public constant LENDING_POOL = 1 << 16; // use proxy
  uint256 public constant LENDING_POOL_CONFIGURATOR = 1 << 17; // use proxy
  uint256 public constant LENDING_POOL_COLLATERAL_MANAGER = 1 << 18;
  uint256 public constant PRICE_ORACLE = 1 << 19;
  uint256 public constant LENDING_RATE_ORACLE = 1 << 20;
  uint256 public constant TREASURY = 1 << 21; // use proxy

  uint256 public constant REWARD_TOKEN = 1 << 22; // use proxy
  uint256 public constant REWARD_STAKE_TOKEN = 1 << 23; // use proxy
  uint256 public constant REWARD_CONTROLLER = 1 << 24;
  uint256 public constant REWARD_CONFIGURATOR = 1 << 25; // use proxy

  uint256 public constant STAKE_CONFIGURATOR = 1 << 26; // use proxy

  // any other roles - use range [32..]
  // these roles can be assigned to multiple addresses

  uint256 public constant REWARD_MINT = 1 << 32;
  uint256 public constant REWARD_BURN = 1 << 33;

  uint256 public constant POOL_SPONSORED_LOAN_USER = 1 << 35;
}
