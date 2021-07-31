// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IReserveStrategy} from './IReserveStrategy.sol';

/**
 * @dev Interface to access the interest rate of an external asset
 */
interface IReserveDelegatedStrategy is IReserveStrategy {
  struct DelegatedState {
    //the liquidity index. Expressed in ray
    uint128 liquidityIndex;
    //variable borrow index. Expressed in ray
    uint128 variableBorrowIndex;
    //the current supply rate. Expressed in ray
    uint128 liquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint128 variableBorrowRate;
    //the current stable borrow rate. Expressed in ray
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
