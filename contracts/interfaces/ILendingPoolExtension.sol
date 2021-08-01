// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from './ILendingPool.sol';
import {ILendingPoolAaveCompatible} from './ILendingPoolAaveCompatible.sol';

/**
 * @title ILendingPoolExtension
 * @notice Delegate of LendingPool for borrow, flashloan and collateral.
 **/
interface ILendingPoolExtension {
  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveDepositToken
  ) external;

  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external;

  function sponsoredFlashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external;

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint256 referral,
    address onBehalfOf
  ) external;

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referral,
    address onBehalfOf
  ) external;

  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referral
  ) external;
}

/// @dev This interface is to ensure signature compatibility of calls delegated from ILendingPool to ILendingPoolExtension
interface DoNotUseLendingPoolChecker is
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

  function sponsoredFlashLoan(
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
