// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../../interfaces/IDepositToken.sol';
import '../../../interfaces/IStableDebtToken.sol';
import '../../../interfaces/IVariableDebtToken.sol';
import '../../../interfaces/IReserveRateStrategy.sol';
import '../../../interfaces/IReserveDelegatedStrategy.sol';
import '../configuration/ReserveConfiguration.sol';
import '../../../tools/math/InterestMath.sol';
import '../../../tools/math/WadRayMath.sol';
import '../../../tools/math/PercentageMath.sol';
import '../../../tools/Errors.sol';
import '../types/DataTypes.sol';

/**
 * @title ReserveLogic library
 * @notice Implements the logic to update the reserves state
 */
library ReserveLogic {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private constant externalPastLimit = 10 minutes;

  /**
   * @dev Emitted when the state of a reserve is updated
   * @param asset The address of the underlying asset of the reserve
   * @param liquidityRate The new liquidity rate
   * @param stableBorrowRate The new stable borrow rate
   * @param variableBorrowRate The new variable borrow rate
   * @param liquidityIndex The new liquidity index
   * @param variableBorrowIndex The new variable borrow index
   **/
  event ReserveDataUpdated(
    address indexed asset,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
  );

  using ReserveLogic for DataTypes.ReserveData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

  /**
   * @dev Returns the ongoing normalized income for the reserve
   * A value of 1e27 means there is no income. As time passes, the income is accrued
   * A value of 2*1e27 means for each unit of asset one unit of income has been accrued
   * @param reserve The reserve object
   * @return the normalized income. expressed in ray
   **/
  function getNormalizedIncome(DataTypes.ReserveData storage reserve, address asset) internal view returns (uint256) {
    uint40 timestamp = reserve.lastUpdateTimestamp;

    if (timestamp == uint40(block.timestamp)) {
      //if the index was updated in the same block, no need to perform any calculation
      return reserve.liquidityIndex;
    }

    if (reserve.configuration.isExternalStrategy()) {
      return IReserveDelegatedStrategy(reserve.strategy).getDelegatedDepositIndex(asset);
    }

    return InterestMath.calculateLinearInterest(reserve.currentLiquidityRate, timestamp).rayMul(reserve.liquidityIndex);
  }

  /**
   * @dev Returns the ongoing normalized variable debt for the reserve
   * A value of 1e27 means there is no debt. As time passes, the income is accrued
   * A value of 2*1e27 means that for each unit of debt, one unit worth of interest has been accumulated
   * @param reserve The reserve object
   * @return The normalized variable debt. expressed in ray
   **/
  function getNormalizedDebt(DataTypes.ReserveData storage reserve) internal view returns (uint256) {
    uint40 timestamp = reserve.lastUpdateTimestamp;

    if (timestamp == uint40(block.timestamp) || reserve.configuration.isExternalStrategy()) {
      //if the index was updated in the same block or is external, no need to perform any calculation
      return reserve.variableBorrowIndex;
    }

    uint256 cumulated = InterestMath.calculateCompoundedInterest(reserve.currentVariableBorrowRate, timestamp).rayMul(
      reserve.variableBorrowIndex
    );

    return cumulated;
  }

  /**
   * @dev Updates the liquidity cumulative index and the variable borrow index.
   * @param reserve the reserve object
   **/
  function updateStateForDeposit(DataTypes.ReserveData storage reserve, address asset) internal returns (uint256) {
    if (reserve.configuration.isExternalStrategy()) {
      return _updateExternalIndexes(reserve, asset);
    }
    return _updateState(reserve);
  }

  /**
   * @dev Updates the liquidity cumulative index and the variable borrow index.
   * @param reserve the reserve object
   **/
  function updateState(DataTypes.ReserveData storage reserve, address asset) internal {
    if (reserve.configuration.isExternalStrategy()) {
      if (reserve.lastUpdateTimestamp < uint40(block.timestamp)) {
        _updateExternalIndexes(reserve, asset);
      }
    } else {
      _updateState(reserve);
    }
  }

  /**
   * @dev Updates the liquidity cumulative index and the variable borrow index.
   * @param reserve the reserve object
   **/
  function _updateState(DataTypes.ReserveData storage reserve) private returns (uint256) {
    uint256 scaledVariableDebt = IVariableDebtToken(reserve.variableDebtTokenAddress).scaledTotalSupply();
    uint256 previousVariableBorrowIndex = reserve.variableBorrowIndex;
    uint256 previousLiquidityIndex = reserve.liquidityIndex;
    uint40 lastUpdatedTimestamp = reserve.lastUpdateTimestamp;

    (uint256 newLiquidityIndex, uint256 newVariableBorrowIndex) = _updateIndexes(
      reserve,
      scaledVariableDebt,
      previousLiquidityIndex,
      previousVariableBorrowIndex,
      lastUpdatedTimestamp
    );

    _mintToTreasury(
      reserve,
      scaledVariableDebt,
      previousVariableBorrowIndex,
      newLiquidityIndex,
      newVariableBorrowIndex,
      lastUpdatedTimestamp
    );

    return newLiquidityIndex;
  }

  /**
   * @dev Accumulates a predefined amount of asset to the reserve as a fixed, instantaneous income. Used for example to accumulate
   * the flashloan fee to the reserve, and spread it between all the depositors
   * @param reserve The reserve object
   * @param totalLiquidity The total liquidity available in the reserve
   * @param amount The amount to accomulate
   **/
  function cumulateToLiquidityIndex(
    DataTypes.ReserveData storage reserve,
    uint256 totalLiquidity,
    uint256 amount
  ) internal {
    uint256 result = WadRayMath.RAY + amount.wadToRay().wadDiv(totalLiquidity);

    result = result.rayMul(reserve.liquidityIndex);
    require(result <= type(uint128).max, Errors.RL_LIQUIDITY_INDEX_OVERFLOW);

    reserve.liquidityIndex = uint128(result);
  }

  /**
   * @dev Initializes a reserve
   **/
  function init(DataTypes.ReserveData storage reserve, DataTypes.InitReserveData calldata data) internal {
    require(reserve.depositTokenAddress == address(0), Errors.RL_RESERVE_ALREADY_INITIALIZED);

    reserve.liquidityIndex = uint128(WadRayMath.RAY);
    reserve.variableBorrowIndex = uint128(WadRayMath.RAY);
    reserve.depositTokenAddress = data.depositTokenAddress;
    reserve.stableDebtTokenAddress = data.stableDebtAddress;
    reserve.variableDebtTokenAddress = data.variableDebtAddress;
    reserve.strategy = data.strategy;
    {
      DataTypes.ReserveConfigurationMap memory cfg = reserve.configuration;
      cfg.setExternalStrategy(data.externalStrategy);
      reserve.configuration = cfg;
    }
  }

  struct UpdateInterestRatesLocalVars {
    uint256 availableLiquidity;
    uint256 totalStableDebt;
    uint256 newLiquidityRate;
    uint256 newStableRate;
    uint256 newVariableRate;
    uint256 avgStableRate;
    uint256 totalVariableDebt;
  }

  /**
   * @dev Updates the reserve current stable borrow rate, the current variable borrow rate and the current liquidity rate
   * @param reserve The address of the reserve to be updated
   * @param liquidityAdded The amount of liquidity added to the protocol (deposit or repay)
   * @param liquidityTaken The amount of liquidity taken from the protocol (redeem or borrow)
   **/
  function updateInterestRates(
    DataTypes.ReserveData storage reserve,
    address reserveAddress,
    address depositToken,
    uint256 liquidityAdded,
    uint256 liquidityTaken
  ) internal {
    if (!reserve.configuration.isExternalStrategy()) {
      _updateInterestRates(reserve, reserveAddress, depositToken, liquidityAdded, liquidityTaken);
    }
    // // There is no need to be exactly at external's asset rate when we don't send or receive funds
    // else if (reserve.lastUpdateTimestamp < uint40(block.timestamp) || liquidityAdded != 0 || liquidityTaken != 0) {
    //   _updateExternalRates(reserve, reserveAddress);
    // }
  }

  function _updateInterestRates(
    DataTypes.ReserveData storage reserve,
    address reserveAddress,
    address depositToken,
    uint256 liquidityAdded,
    uint256 liquidityTaken
  ) private {
    UpdateInterestRatesLocalVars memory vars;

    (vars.totalStableDebt, vars.avgStableRate) = IStableDebtToken(reserve.stableDebtTokenAddress)
      .getTotalSupplyAndAvgRate();

    //calculates the total variable debt locally using the scaled total supply instead
    //of totalSupply(), as it's noticeably cheaper. Also, the index has been
    //updated by the previous updateState() call
    vars.totalVariableDebt = IVariableDebtToken(reserve.variableDebtTokenAddress).scaledTotalSupply().rayMul(
      reserve.variableBorrowIndex
    );

    (vars.newLiquidityRate, vars.newStableRate, vars.newVariableRate) = IReserveRateStrategy(reserve.strategy)
      .calculateInterestRates(
        reserveAddress,
        depositToken,
        liquidityAdded,
        liquidityTaken,
        vars.totalStableDebt,
        vars.totalVariableDebt,
        vars.avgStableRate,
        reserve.configuration.getReserveFactor()
      );
    require(vars.newLiquidityRate <= type(uint128).max, Errors.RL_LIQUIDITY_RATE_OVERFLOW);
    require(vars.newStableRate <= type(uint128).max, Errors.RL_STABLE_BORROW_RATE_OVERFLOW);
    require(vars.newVariableRate <= type(uint128).max, Errors.RL_VARIABLE_BORROW_RATE_OVERFLOW);

    reserve.currentLiquidityRate = uint128(vars.newLiquidityRate);
    reserve.currentStableBorrowRate = uint128(vars.newStableRate);
    reserve.currentVariableBorrowRate = uint128(vars.newVariableRate);

    emit ReserveDataUpdated(
      reserveAddress,
      vars.newLiquidityRate,
      vars.newStableRate,
      vars.newVariableRate,
      reserve.liquidityIndex,
      reserve.variableBorrowIndex
    );
  }

  struct MintToTreasuryLocalVars {
    uint256 currentStableDebt;
    uint256 principalStableDebt;
    uint256 previousStableDebt;
    uint256 currentVariableDebt;
    uint256 previousVariableDebt;
    uint256 avgStableRate;
    uint256 cumulatedStableInterest;
    uint256 totalDebtAccrued;
    uint256 amountToMint;
    uint256 reserveFactor;
    uint40 stableSupplyUpdatedTimestamp;
  }

  /**
   * @dev Mints part of the repaid interest to the reserve treasury as a function of the reserveFactor for the
   * specific asset.
   * @param reserve The reserve reserve to be updated
   * @param scaledVariableDebt The current scaled total variable debt
   * @param previousVariableBorrowIndex The variable borrow index before the last accumulation of the interest
   * @param newLiquidityIndex The new liquidity index
   * @param newVariableBorrowIndex The variable borrow index after the last accumulation of the interest
   **/
  function _mintToTreasury(
    DataTypes.ReserveData storage reserve,
    uint256 scaledVariableDebt,
    uint256 previousVariableBorrowIndex,
    uint256 newLiquidityIndex,
    uint256 newVariableBorrowIndex,
    uint40 timestamp
  ) private {
    MintToTreasuryLocalVars memory vars;

    vars.reserveFactor = reserve.configuration.getReserveFactor();

    if (vars.reserveFactor == 0) {
      return;
    }

    //fetching the principal, total stable debt and the avg stable rate
    (
      vars.principalStableDebt,
      vars.currentStableDebt,
      vars.avgStableRate,
      vars.stableSupplyUpdatedTimestamp
    ) = IStableDebtToken(reserve.stableDebtTokenAddress).getSupplyData();

    //calculate the last principal variable debt
    vars.previousVariableDebt = scaledVariableDebt.rayMul(previousVariableBorrowIndex);

    //calculate the new total supply after accumulation of the index
    vars.currentVariableDebt = scaledVariableDebt.rayMul(newVariableBorrowIndex);

    //calculate the stable debt until the last timestamp update
    vars.cumulatedStableInterest = InterestMath.calculateCompoundedInterest(
      vars.avgStableRate,
      vars.stableSupplyUpdatedTimestamp,
      timestamp
    );

    vars.previousStableDebt = vars.principalStableDebt.rayMul(vars.cumulatedStableInterest);

    //debt accrued is the sum of the current debt minus the sum of the debt at the last update
    vars.totalDebtAccrued =
      (vars.currentVariableDebt + vars.currentStableDebt) -
      (vars.previousVariableDebt + vars.previousStableDebt);

    vars.amountToMint = vars.totalDebtAccrued.percentMul(vars.reserveFactor);

    if (vars.amountToMint != 0) {
      IDepositToken(reserve.depositTokenAddress).mintToTreasury(vars.amountToMint, newLiquidityIndex);
    }
  }

  /**
   * @dev Updates the reserve indexes and the timestamp of the update
   * @param reserve The reserve reserve to be updated
   * @param scaledVariableDebt The scaled variable debt
   * @param liquidityIndex The last stored liquidity index
   * @param variableBorrowIndex The last stored variable borrow index
   **/
  function _updateIndexes(
    DataTypes.ReserveData storage reserve,
    uint256 scaledVariableDebt,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex,
    uint40 timestamp
  ) private returns (uint256, uint256) {
    uint256 currentLiquidityRate = reserve.currentLiquidityRate;

    uint256 newLiquidityIndex = liquidityIndex;
    uint256 newVariableBorrowIndex = variableBorrowIndex;

    //only cumulating if there is any income being produced
    if (currentLiquidityRate > 0) {
      uint256 cumulatedLiquidityInterest = InterestMath.calculateLinearInterest(currentLiquidityRate, timestamp);
      newLiquidityIndex = cumulatedLiquidityInterest.rayMul(liquidityIndex);
      require(newLiquidityIndex <= type(uint128).max, Errors.RL_LIQUIDITY_INDEX_OVERFLOW);

      reserve.liquidityIndex = uint128(newLiquidityIndex);

      //as the liquidity rate might come only from stable rate loans, we need to ensure
      //that there is actual variable debt before accumulating
      if (scaledVariableDebt != 0) {
        uint256 cumulatedVariableBorrowInterest = InterestMath.calculateCompoundedInterest(
          reserve.currentVariableBorrowRate,
          timestamp
        );
        newVariableBorrowIndex = cumulatedVariableBorrowInterest.rayMul(variableBorrowIndex);
        require(newVariableBorrowIndex <= type(uint128).max, Errors.RL_VARIABLE_BORROW_INDEX_OVERFLOW);
        reserve.variableBorrowIndex = uint128(newVariableBorrowIndex);
      }
    }

    reserve.lastUpdateTimestamp = uint40(block.timestamp);
    return (newLiquidityIndex, newVariableBorrowIndex);
  }

  function _updateExternalIndexes(DataTypes.ReserveData storage reserve, address asset) private returns (uint256) {
    IReserveDelegatedStrategy.DelegatedState memory state = IReserveDelegatedStrategy(reserve.strategy)
      .getDelegatedState(asset, reserve.lastUpdateTimestamp);
    require(state.lastUpdateTimestamp <= block.timestamp);

    if (state.lastUpdateTimestamp == reserve.lastUpdateTimestamp) {
      if (state.liquidityIndex == reserve.liquidityIndex) {
        return state.liquidityIndex;
      }
    } else {
      require(state.lastUpdateTimestamp > reserve.lastUpdateTimestamp);
      reserve.lastUpdateTimestamp = state.lastUpdateTimestamp;
    }

    reserve.variableBorrowIndex = state.variableBorrowIndex;
    reserve.currentLiquidityRate = state.liquidityRate;
    reserve.currentVariableBorrowRate = state.variableBorrowRate;
    reserve.currentStableBorrowRate = state.stableBorrowRate;
    reserve.liquidityIndex = state.liquidityIndex;

    return state.liquidityIndex;
  }

  // function _updateExternalRates(DataTypes.ReserveData storage reserve, address asset) private {
  //   // nothing to do - all was updated inside _updateExternalIndexes
  // }
}
