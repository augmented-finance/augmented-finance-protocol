// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import './IReserveStrategy.sol';

/// @dev Interface to access the interest rate of an external asset
interface IReserveDelegatedStrategy is IReserveStrategy {
  /// @dev all indexes and rates are expressed in ray
  struct DelegatedState {
    uint128 liquidityIndex;
    uint128 variableBorrowIndex;
    uint128 liquidityRate;
    uint128 variableBorrowRate;
    uint128 stableBorrowRate;
    uint40 lastUpdateTimestamp;
  }

  function getDelegatedState(address underlyingToken) external view returns (DelegatedState memory);

  function getDelegatedDepositIndex(address underlyingToken)
    external
    view
    returns (uint256 liquidityIndex);

  function getDelegatedVariableBorrowIndex(address underlyingToken)
    external
    view
    returns (uint256 variableBorrowIndex);
}
