// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IReserveStrategy} from './IReserveStrategy.sol';

/**
 * @dev Interface to access the interest rate of an external asset
 */
interface IReserveDelegatedStrategy is IReserveStrategy {
  function getDelegatedIndexes(address underlyingToken)
    external
    view
    returns (uint256 liquidityIndex, uint256 variableBorrowIndex);

  function getDelegatedIncomeIndex(address underlyingToken)
    external
    view
    returns (uint256 liquidityIndex);
}
