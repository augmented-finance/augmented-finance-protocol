// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

struct PoolTokenConfig {
  // The address of the associated lending pool
  address pool;
  // The address of the treasury
  address treasury;
  // The address of the underlying asset
  address underlyingAsset;
}
