// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './ILendingPool.sol';
import './ILendingPoolExtension.sol';
import './ILendingPoolAaveCompatible.sol';

/// @dev This interface is to ensure signature compatibility of calls delegated from ILendingPool to ILendingPoolExtension
interface DoNotUseLendingPoolDelegationChecker is
  ILendingPool,
  ILendingPoolAaveCompatible,
  ILendingPoolExtension
{
  function borrow(
    address,
    uint256,
    uint256,
    uint256,
    address
  ) external override(ILendingPoolExtension, ILendingPool);

  function liquidationCall(
    address,
    address,
    address,
    uint256,
    bool
  ) external override(ILendingPoolExtension, ILendingPool);

  function flashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint256
  ) external override(ILendingPoolExtension, ILendingPool);

  function borrow(
    address,
    uint256,
    uint256,
    uint16,
    address
  ) external override(ILendingPoolExtension, ILendingPoolAaveCompatible);

  function flashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint16
  ) external override(ILendingPoolExtension, ILendingPoolAaveCompatible);
}
