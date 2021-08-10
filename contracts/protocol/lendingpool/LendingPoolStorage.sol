// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../libraries/configuration/UserConfiguration.sol';
import '../libraries/configuration/ReserveConfiguration.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../libraries/types/DataTypes.sol';

abstract contract LendingPoolStorage is VersionedInitializable {
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  IMarketAccessController internal _addressesProvider;
  address internal _extension;

  mapping(address => DataTypes.ReserveData) internal _reserves;
  mapping(address => DataTypes.UserConfigurationMap) internal _usersConfig;

  // the list of the available reserves, structured as a mapping for gas savings reasons
  mapping(uint256 => address) internal _reservesList;

  uint16 internal _maxStableRateBorrowSizePct;

  uint16 internal _flashLoanPremiumPct;

  uint16 internal constant FEATURE_FLASHLOAN = 1 << 0;
  uint16 internal constant FEATURE_LIQUIDATION = 1 << 1;
  uint16 internal _disabledFeatures;

  uint8 internal _reservesCount;

  uint8 internal constant _maxNumberOfReserves = 128;

  uint8 internal _flashloanCalls;
  uint8 internal _nestedCalls;

  bool internal _paused;
}
