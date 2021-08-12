// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/interfaces/IMarketAccessController.sol';
import '../protocol/libraries/types/DataTypes.sol';

interface ILendingPoolEvents {
  /// @dev Emitted on deposit()
  event Deposit(
    address indexed reserve,
    address user,
    address indexed onBehalfOf,
    uint256 amount,
    uint256 indexed referral
  );

  /// @dev Emitted on withdraw()
  event Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount);

  /// @dev Emitted on borrow() and flashLoan() when debt needs to be opened
  event Borrow(
    address indexed reserve,
    address user,
    address indexed onBehalfOf,
    uint256 amount,
    uint256 borrowRateMode,
    uint256 borrowRate,
    uint256 indexed referral
  );

  /// @dev Emitted on repay()
  event Repay(
    address indexed reserve,
    address indexed user,
    address indexed repayer,
    uint256 amount
  );

  /// @dev Emitted on swapBorrowRateMode()
  event Swap(address indexed reserve, address indexed user, uint256 rateMode);

  /// @dev Emitted on setUserUseReserveAsCollateral()
  event ReserveUsedAsCollateralEnabled(address indexed reserve, address indexed user);

  /// @dev Emitted on setUserUseReserveAsCollateral()
  event ReserveUsedAsCollateralDisabled(address indexed reserve, address indexed user);

  /// @dev Emitted on rebalanceStableBorrowRate()
  event RebalanceStableBorrowRate(address indexed reserve, address indexed user);

  /// @dev Emitted on flashLoan()
  event FlashLoan(
    address indexed target,
    address indexed initiator,
    address indexed asset,
    uint256 amount,
    uint256 premium,
    uint256 referral
  );

  /// @dev Emitted when a borrower is liquidated.
  event LiquidationCall(
    address indexed collateralAsset,
    address indexed debtAsset,
    address indexed user,
    uint256 debtToCover,
    uint256 liquidatedCollateralAmount,
    address liquidator,
    bool receiveDeposit
  );

  /// @dev Emitted when the state of a reserve is updated.
  event ReserveDataUpdated(
    address indexed underlying,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
  );

  event LendingPoolExtensionUpdated(address extension);

  event DisabledFeaturesUpdated(uint16 disabledFeatures);

  event FlashLoanPremiumUpdated(uint16 premium);
}
