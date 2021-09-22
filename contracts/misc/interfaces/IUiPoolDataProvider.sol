// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

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
    bool isExternalStrategy;
    //
    uint256 availableLiquidity;
    uint256 totalPrincipalStableDebt;
    uint256 averageStableRate;
    uint256 totalStableDebt;
    uint256 stableDebtLastUpdateTimestamp;
    uint256 totalScaledVariableDebt;
    uint256 priceInEth;
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

  function getReservesData(address user)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    );

  function getReserveData(address asset)
    external
    view
    returns (
      uint256 availableLiquidity,
      uint256 totalStableDebt,
      uint256 totalVariableDebt,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 stableBorrowRate,
      uint256 averageStableBorrowRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      uint40 lastUpdateTimestamp
    );

  function getUserReserveData(address asset, address user)
    external
    view
    returns (
      uint256 currentDepositBalance,
      uint256 currentStableDebt,
      uint256 currentVariableDebt,
      uint256 principalStableDebt,
      uint256 scaledVariableDebt,
      uint256 stableBorrowRate,
      uint256 liquidityRate,
      uint40 stableRateLastUpdated,
      bool usageAsCollateralEnabled
    );

  enum TokenType {
    PoolAsset,
    Deposit,
    VariableDebt,
    StableDebt,
    Stake,
    Reward,
    RewardStake
  }

  struct TokenDescription {
    address token;
    // priceToken == 0 for a non-transferrable token
    address priceToken;
    address rewardPool;
    string tokenSymbol;
    address underlying;
    uint8 decimals;
    TokenType tokenType;
    bool active;
    bool frozen;
  }

  function getAllTokenDescriptions(bool includeAssets)
    external
    view
    returns (TokenDescription[] memory tokens, uint256 tokenCount);

  function getAllTokens(bool includeAssets)
    external
    view
    returns (
      address[] memory tokens,
      uint256 tokenCount,
      TokenType[] memory tokenTypes
    );

  function getReserveConfigurationData(address asset)
    external
    view
    returns (
      uint256 decimals,
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 liquidationBonus,
      uint256 reserveFactor,
      bool usageAsCollateralEnabled,
      bool borrowingEnabled,
      bool stableBorrowRateEnabled,
      bool isActive,
      bool isFrozen
    );

  struct TokenBalance {
    uint256 balance;
    uint256 underlyingBalance;
    uint256 rewardedBalance;
    uint32 unstakeWindowStart;
    uint32 unstakeWindowEnd;
  }

  function batchBalanceOf(
    address[] calldata users,
    address[] calldata tokens,
    TokenType[] calldata tokenTypes,
    TokenType defType
  ) external view returns (TokenBalance[] memory);
}
