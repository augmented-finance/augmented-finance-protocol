// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

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
