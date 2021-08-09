// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import '../../interfaces/IPoolAddressProvider.sol';

interface IUiPoolDataProvider {
  struct Addresses {
    address addressProvider;
    address lendingPool;
    address stakeConfigurator;
    address rewardConfigurator;
    address rewardController;
    address wethGateway;
    address priceOracle;
    address lendingPriceOracle;
    address rewardToken;
    address rewardStake;
    address referralRegistry;
  }

  function getAddresses() external view returns (Addresses memory);

  struct AggregatedReserveData {
    address underlyingAsset;
    address pricingAsset;
    string name;
    string symbol;
    uint256 decimals;
    uint256 baseLTVasCollateral;
    uint256 reserveLiquidationThreshold;
    uint256 reserveLiquidationBonus;
    uint256 reserveFactor;
    bool usageAsCollateralEnabled;
    bool borrowingEnabled;
    bool stableBorrowRateEnabled;
    bool isActive;
    bool isFrozen;
    // base data
    uint128 liquidityIndex;
    uint128 variableBorrowIndex;
    uint128 liquidityRate;
    uint128 variableBorrowRate;
    uint128 stableBorrowRate;
    uint40 lastUpdateTimestamp;
    address depositTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address strategy;
    //
    uint256 availableLiquidity;
    uint256 totalPrincipalStableDebt;
    uint256 averageStableRate;
    uint256 stableDebtLastUpdateTimestamp;
    uint256 totalScaledVariableDebt;
    uint256 priceInEth;
    uint256 variableRateSlope1;
    uint256 variableRateSlope2;
    uint256 stableRateSlope1;
    uint256 stableRateSlope2;
  }

  struct UserReserveData {
    address underlyingAsset;
    uint256 scaledDepositTokenBalance;
    bool usageAsCollateralEnabledOnUser;
    uint256 stableBorrowRate;
    uint256 scaledVariableDebt;
    uint256 principalStableDebt;
    uint256 stableBorrowLastUpdateTimestamp;
  }

  function getReservesDataOf(IPoolAddressProvider provider, address user)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    );

  function getReservesData(address user)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    );
}
