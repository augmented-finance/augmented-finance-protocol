// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IEmergencyAccessGroup.sol';

interface ILendingPoolConfigurator {
  struct InitReserveInput {
    address depositTokenImpl;
    address stableDebtTokenImpl;
    address variableDebtTokenImpl;
    uint8 underlyingAssetDecimals;
    bool externalStrategy;
    address strategy;
    address underlyingAsset;
    string depositTokenName;
    string depositTokenSymbol;
    string variableDebtTokenName;
    string variableDebtTokenSymbol;
    string stableDebtTokenName;
    string stableDebtTokenSymbol;
    bytes params;
  }

  struct UpdatePoolTokenInput {
    address asset;
    string name;
    string symbol;
    address implementation;
    bytes params;
  }

  struct ConfigureReserveInput {
    address asset;
    uint256 baseLTV;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 reserveFactor;
    bool borrowingEnabled;
    bool stableBorrowingEnabled;
  }

  event ReserveInitialized(
    address indexed asset,
    address indexed depositToken,
    address stableDebtToken,
    address variableDebtToken,
    address strategy,
    bool externalStrategy
  );

  event BorrowingEnabledOnReserve(address indexed asset, bool stableRateEnabled);
  event BorrowingDisabledOnReserve(address indexed asset);

  event CollateralConfigurationChanged(
    address indexed asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  );

  event StableRateEnabledOnReserve(address indexed asset);
  event StableRateDisabledOnReserve(address indexed asset);

  event ReserveActivated(address indexed asset);
  event ReserveDeactivated(address indexed asset);

  event ReserveFrozen(address indexed asset);
  event ReserveUnfrozen(address indexed asset);

  event ReserveFactorChanged(address indexed asset, uint256 factor);
  event ReserveStrategyChanged(address indexed asset, address strategy, bool isExternal);

  event DepositTokenUpgraded(address indexed asset, address indexed proxy, address indexed implementation);

  event StableDebtTokenUpgraded(address indexed asset, address indexed proxy, address indexed implementation);

  event VariableDebtTokenUpgraded(address indexed asset, address indexed proxy, address indexed implementation);

  function getFlashloanAdapters(string[] calldata names) external view returns (address[] memory adapters);
}
