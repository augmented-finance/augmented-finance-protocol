// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

struct PoolTokenConfig {
  // Address of the associated lending pool
  address pool;
  // Address of the treasury
  address treasury;
  // Address of the underlying asset
  address underlyingAsset;
  // Decimals of the underlying asset
  uint8 underlyingDecimals;
}
