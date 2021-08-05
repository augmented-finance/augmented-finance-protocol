// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IManagedLendingPool} from '../../../interfaces/IManagedLendingPool.sol';
import '../../../interfaces/IBalanceHook.sol';

struct PoolTokenConfig {
  // The address of the associated lending pool
  IManagedLendingPool pool;
  // The address of the treasury
  address treasury;
  // The address of the underlying asset
  address underlyingAsset;
}
