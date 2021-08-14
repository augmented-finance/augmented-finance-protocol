// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../types/DataTypes.sol';

/// @dev Implements the bitmap logic to handle the user configuration
library UserConfiguration {
  uint256 internal constant BORROWING_MASK = 0x5555555555555555555555555555555555555555555555555555555555555555;

  /// @dev Sets the user's borrowing flag of the reserve identified by reserveIndex
  function setBorrowing(
    DataTypes.UserConfigurationMap storage self,
    uint256 reserveIndex,
    bool borrowing
  ) internal {
    require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
    self.data = (self.data & ~(1 << (reserveIndex * 2))) | (uint256(borrowing ? 1 : 0) << (reserveIndex * 2));
  }

  /// @dev Sets the user's `using as collateral` flag on the reserve identified by reserveIndex
  function setUsingAsCollateral(
    DataTypes.UserConfigurationMap storage self,
    uint256 reserveIndex,
    bool usingAsCollateral
  ) internal {
    require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
    self.data =
      (self.data & ~(1 << (reserveIndex * 2 + 1))) |
      (uint256(usingAsCollateral ? 1 : 0) << (reserveIndex * 2 + 1));
  }

  /// @dev Returns true if the user is using the reserve for borrowing or as collateral
  function isUsingAsCollateralOrBorrowing(DataTypes.UserConfigurationMap memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool, bool)
  {
    uint256 data = self.data >> (reserveIndex << 1);
    return (data > 0, data & 3 != 0);
  }

  /// @dev Returns true if the user is using the reserve for borrowing
  function isBorrowing(DataTypes.UserConfigurationMap memory self, uint256 reserveIndex) internal pure returns (bool) {
    require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
    return (self.data >> (reserveIndex * 2)) & 1 != 0;
  }

  /// @dev Returns true if the user is using the reserve as collateral
  function isUsingAsCollateral(DataTypes.UserConfigurationMap memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool)
  {
    require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
    return (self.data >> (reserveIndex * 2 + 1)) & 1 != 0;
  }

  /// @dev Returns true if the user is borrowing from any reserve
  function isBorrowingAny(DataTypes.UserConfigurationMap memory self) internal pure returns (bool) {
    return self.data & BORROWING_MASK != 0;
  }

  /// @dev Returns true if the user is not using any reserve
  function isEmpty(DataTypes.UserConfigurationMap memory self) internal pure returns (bool) {
    return self.data == 0;
  }
}
