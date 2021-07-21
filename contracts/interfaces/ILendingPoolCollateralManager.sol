// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from './ILendingPool.sol';

/**
 * @title ILendingPoolCollateralManager
 * @notice Delegate of LendingPool for borrow, flashloan and collateral.
 **/
interface ILendingPoolCollateralManager {
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
}

/// @dev This interface is to ensure signature compatibility of calls delegated from ILendingPool to ILendingPoolCollateralManager
interface DoNotUseLendingPoolCompatibilityChecker is ILendingPool, ILendingPoolCollateralManager {
  function borrow(
    address,
    uint256,
    uint256,
    uint256,
    address
  ) external override(ILendingPoolCollateralManager, ILendingPool);

  function liquidationCall(
    address,
    address,
    address,
    uint256,
    bool
  ) external override(ILendingPoolCollateralManager, ILendingPool);

  function flashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint256
  ) external override(ILendingPoolCollateralManager, ILendingPool);

  function sponsoredFlashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint256
  ) external override(ILendingPoolCollateralManager, ILendingPool);
}
