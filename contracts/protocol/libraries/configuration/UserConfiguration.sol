// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../types/DataTypes.sol';

/// @dev Implements the bitmap logic to handle the user configuration
library UserConfiguration {
  uint256 private constant ANY_BORROWING_MASK = 0x5555555555555555555555555555555555555555555555555555555555555555;
  uint256 private constant BORROW_BIT_MASK = 1;
  uint256 private constant COLLATERAL_BIT_MASK = 2;
  uint256 internal constant ANY_MASK = BORROW_BIT_MASK | COLLATERAL_BIT_MASK;
  uint256 internal constant SHIFT_STEP = 2;

  function setBorrowing(DataTypes.UserConfigurationMap storage self, uint256 reserveIndex) internal {
    self.data |= BORROW_BIT_MASK << (reserveIndex << 1);
  }

  function unsetBorrowing(DataTypes.UserConfigurationMap storage self, uint256 reserveIndex) internal {
    self.data &= ~(BORROW_BIT_MASK << (reserveIndex << 1));
  }

  function setUsingAsCollateral(DataTypes.UserConfigurationMap storage self, uint256 reserveIndex) internal {
    self.data |= COLLATERAL_BIT_MASK << (reserveIndex << 1);
  }

  function unsetUsingAsCollateral(DataTypes.UserConfigurationMap storage self, uint256 reserveIndex) internal {
    self.data &= ~(COLLATERAL_BIT_MASK << (reserveIndex << 1));
  }

  /// @dev Returns true if the user is using the reserve for borrowing
  function isBorrowing(DataTypes.UserConfigurationMap memory self, uint256 reserveIndex) internal pure returns (bool) {
    return (self.data >> (reserveIndex << 1)) & BORROW_BIT_MASK != 0;
  }

  /// @dev Returns true if the user is using the reserve as collateral
  function isUsingAsCollateral(DataTypes.UserConfigurationMap memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool)
  {
    return (self.data >> (reserveIndex << 1)) & COLLATERAL_BIT_MASK != 0;
  }

  /// @dev Returns true if the user is borrowing from any reserve
  function isBorrowingAny(DataTypes.UserConfigurationMap memory self) internal pure returns (bool) {
    return self.data & ANY_BORROWING_MASK != 0;
  }

  /// @dev Returns true if the user is not using any reserve
  function isEmpty(DataTypes.UserConfigurationMap memory self) internal pure returns (bool) {
    return self.data == 0;
  }
}
