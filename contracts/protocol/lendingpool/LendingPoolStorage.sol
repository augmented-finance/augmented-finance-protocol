// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../libraries/types/DataTypes.sol';

abstract contract LendingPoolStorage is VersionedInitializable {
  IMarketAccessController internal _addressesProvider;
  address internal _extension;

  mapping(address => DataTypes.ReserveData) internal _reserves;
  mapping(address => DataTypes.UserConfigurationMap) internal _usersConfig;

  // the list of the available reserves, structured as a mapping for gas savings reasons
  mapping(uint256 => address) internal _reservesList;

  uint16 internal _maxStableRateBorrowSizePct;

  uint16 internal _flashLoanPremiumPct;

  uint16 internal constant FEATURE_LIQUIDATION = 1 << 0;
  uint16 internal constant FEATURE_FLASHLOAN = 1 << 1;
  uint16 internal constant FEATURE_FLASHLOAN_DEPOSIT = 1 << 2;
  uint16 internal constant FEATURE_FLASHLOAN_WITHDRAW = 1 << 3;
  uint16 internal constant FEATURE_FLASHLOAN_BORROW = 1 << 4;
  uint16 internal constant FEATURE_FLASHLOAN_REPAY = 1 << 5;
  uint16 internal _disabledFeatures;

  uint8 internal _reservesCount;

  uint8 internal constant _maxNumberOfReserves = 128;

  uint8 internal _flashloanCalls;
  uint8 internal _nestedCalls;

  bool internal _paused;

  mapping(address => address[]) internal _indirectUnderlying;
}
