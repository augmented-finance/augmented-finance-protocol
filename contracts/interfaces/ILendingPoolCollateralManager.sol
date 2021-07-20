// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title ILendingPoolCollateralManager
 * @notice Delegate of LendingPool for borrow, flashloan and collateral.
 **/
interface ILendingPoolCollateralManager {
  function liquidationCall(
    address collateral,
    address principal,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external returns (bool, string memory);

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral,
    uint16 flPremium
  ) external returns (bool, string memory);

  function executeBorrow(
    address asset,
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 interestRateMode,
    uint256 referral,
    bool releaseUnderlying
  ) external returns (bool, string memory);
}
