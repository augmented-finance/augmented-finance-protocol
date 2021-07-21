// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../dependencies/openzeppelin/contracts//SafeMath.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts//IERC20.sol';
import {IDepositToken} from '../../interfaces/IDepositToken.sol';
import {IStableDebtToken} from '../../interfaces/IStableDebtToken.sol';
import {IVariableDebtToken} from '../../interfaces/IVariableDebtToken.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
import {ILendingPoolCollateralManager} from '../../interfaces/ILendingPoolCollateralManager.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {Helpers} from '../libraries/helpers/Helpers.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {ValidationLogic} from '../libraries/logic/ValidationLogic.sol';
import {DataTypes} from '../libraries/types/DataTypes.sol';
import {LendingPoolStorage} from './LendingPoolStorage.sol';
import {IFlashLoanReceiver} from '../../flashloan/interfaces/IFlashLoanReceiver.sol';
import {ILendingPoolEvents} from '../../interfaces/ILendingPoolEvents.sol';

/**
 * @title LendingPoolCollateralManager contract
 * @dev Implements actions involving management of collateral in the protocol, the main one being the liquidations
 * IMPORTANT This contract will run always via DELEGATECALL, through the LendingPool, so the chain of inheritance
 * is the same as the LendingPool, to have compatible storage layouts
 **/
contract LendingPoolCollateralManager is
  VersionedInitializable,
  LendingPoolStorage,
  ILendingPoolCollateralManager,
  ILendingPoolEvents
{
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint256 internal constant LIQUIDATION_CLOSE_FACTOR_PERCENT = 5000;

  struct LiquidationCallLocalVars {
    uint256 userCollateralBalance;
    uint256 userStableDebt;
    uint256 userVariableDebt;
    uint256 maxLiquidatableDebt;
    uint256 actualDebtToLiquidate;
    uint256 liquidationRatio;
    uint256 maxAmountCollateralToLiquidate;
    uint256 userStableRate;
    uint256 maxCollateralToLiquidate;
    uint256 debtAmountNeeded;
    uint256 healthFactor;
    uint256 liquidatorPreviousATokenBalance;
    IDepositToken collateralAtoken;
    bool isCollateralEnabled;
    DataTypes.InterestRateMode borrowRateMode;
  }

  /**
   * @dev As this contract extends the VersionedInitializable contract to match the state
   * of the LendingPool contract, the getRevision() function is needed, but should never be called
   */
  function getRevision() internal pure override returns (uint256) {
    revert('IMPOSSIBLE');
  }

  /**
   * @dev Function to liquidate a position if its Health Factor drops below 1
   * - The caller (liquidator) covers `debtToCover` amount of debt of the user getting liquidated, and receives
   *   a proportionally amount of the `collateralAsset` plus a bonus to cover market risk
   * @param collateralAsset The address of the underlying asset used as collateral, to receive as result of the liquidation
   * @param debtAsset The address of the underlying borrowed asset to be repaid with the liquidation
   * @param user The address of the borrower getting liquidated
   * @param debtToCover The debt amount of borrowed `asset` the liquidator wants to cover
   * @param receiveDepositToken `true` if the liquidators wants to receive the collateral aTokens, `false` if he wants
   * to receive the underlying collateral asset directly
   **/

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveDepositToken
  ) external override {
    DataTypes.ReserveData storage collateralReserve = _reserves[collateralAsset];
    DataTypes.ReserveData storage debtReserve = _reserves[debtAsset];
    DataTypes.UserConfigurationMap storage userConfig = _usersConfig[user];

    LiquidationCallLocalVars memory vars;

    (, , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
      user,
      _reserves,
      userConfig,
      _reservesList,
      _reservesCount,
      _addressesProvider.getPriceOracle()
    );

    (vars.userStableDebt, vars.userVariableDebt) = Helpers.getUserCurrentDebt(user, debtReserve);

    ValidationLogic.validateLiquidationCall(
      collateralReserve,
      debtReserve,
      userConfig,
      vars.healthFactor,
      vars.userStableDebt,
      vars.userVariableDebt
    );

    vars.collateralAtoken = IDepositToken(collateralReserve.aTokenAddress);

    vars.userCollateralBalance = vars.collateralAtoken.balanceOf(user);

    vars.maxLiquidatableDebt = vars.userStableDebt.add(vars.userVariableDebt).percentMul(
      LIQUIDATION_CLOSE_FACTOR_PERCENT
    );

    vars.actualDebtToLiquidate = debtToCover > vars.maxLiquidatableDebt
      ? vars.maxLiquidatableDebt
      : debtToCover;

    (
      vars.maxCollateralToLiquidate,
      vars.debtAmountNeeded
    ) = _calculateAvailableCollateralToLiquidate(
      collateralReserve,
      debtReserve,
      collateralAsset,
      debtAsset,
      vars.actualDebtToLiquidate,
      vars.userCollateralBalance
    );

    // If debtAmountNeeded < actualDebtToLiquidate, there isn't enough
    // collateral to cover the actual amount that is being liquidated, hence we liquidate
    // a smaller amount

    if (vars.debtAmountNeeded < vars.actualDebtToLiquidate) {
      vars.actualDebtToLiquidate = vars.debtAmountNeeded;
    }

    // If the liquidator reclaims the underlying asset, we make sure there is enough available liquidity in the
    // collateral reserve
    if (!receiveDepositToken) {
      uint256 currentAvailableCollateral =
        IERC20(collateralAsset).balanceOf(address(vars.collateralAtoken));
      require(
        currentAvailableCollateral >= vars.maxCollateralToLiquidate,
        Errors.LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE
      );
    }

    debtReserve.updateState(debtAsset);

    if (vars.userVariableDebt >= vars.actualDebtToLiquidate) {
      IVariableDebtToken(debtReserve.variableDebtTokenAddress).burn(
        user,
        vars.actualDebtToLiquidate,
        debtReserve.variableBorrowIndex
      );
    } else {
      // If the user doesn't have variable debt, no need to try to burn variable debt tokens
      if (vars.userVariableDebt > 0) {
        IVariableDebtToken(debtReserve.variableDebtTokenAddress).burn(
          user,
          vars.userVariableDebt,
          debtReserve.variableBorrowIndex
        );
      }
      IStableDebtToken(debtReserve.stableDebtTokenAddress).burn(
        user,
        vars.actualDebtToLiquidate.sub(vars.userVariableDebt)
      );
    }

    debtReserve.updateInterestRates(
      debtAsset,
      debtReserve.aTokenAddress,
      vars.actualDebtToLiquidate,
      0
    );

    if (receiveDepositToken) {
      vars.liquidatorPreviousATokenBalance = IERC20(vars.collateralAtoken).balanceOf(msg.sender);
      vars.collateralAtoken.transferOnLiquidation(user, msg.sender, vars.maxCollateralToLiquidate);

      if (vars.liquidatorPreviousATokenBalance == 0) {
        DataTypes.UserConfigurationMap storage liquidatorConfig = _usersConfig[msg.sender];
        liquidatorConfig.setUsingAsCollateral(collateralReserve.id, true);
        emit ReserveUsedAsCollateralEnabled(collateralAsset, msg.sender);
      }
    } else {
      collateralReserve.updateState(collateralAsset);
      collateralReserve.updateInterestRates(
        collateralAsset,
        address(vars.collateralAtoken),
        0,
        vars.maxCollateralToLiquidate
      );

      // Burn the equivalent amount of aToken, sending the underlying to the liquidator
      vars.collateralAtoken.burn(
        user,
        msg.sender,
        vars.maxCollateralToLiquidate,
        collateralReserve.liquidityIndex
      );
    }

    // If the collateral being liquidated is equal to the user balance,
    // we set the currency as not being used as collateral anymore
    if (vars.maxCollateralToLiquidate == vars.userCollateralBalance) {
      userConfig.setUsingAsCollateral(collateralReserve.id, false);
      emit ReserveUsedAsCollateralDisabled(collateralAsset, user);
    }

    // Transfers the debt asset being repaid to the aToken, where the liquidity is kept
    IERC20(debtAsset).safeTransferFrom(
      msg.sender,
      debtReserve.aTokenAddress,
      vars.actualDebtToLiquidate
    );

    emit LiquidationCall(
      collateralAsset,
      debtAsset,
      user,
      vars.actualDebtToLiquidate,
      vars.maxCollateralToLiquidate,
      msg.sender,
      receiveDepositToken
    );
  }

  struct AvailableCollateralToLiquidateLocalVars {
    uint256 userCompoundedBorrowBalance;
    uint256 liquidationBonus;
    uint256 collateralPrice;
    uint256 debtAssetPrice;
    uint256 maxAmountCollateralToLiquidate;
    uint256 debtAssetDecimals;
    uint256 collateralDecimals;
  }

  /**
   * @dev Calculates how much of a specific collateral can be liquidated, given
   * a certain amount of debt asset.
   * - This function needs to be called after all the checks to validate the liquidation have been performed,
   *   otherwise it might fail.
   * @param collateralReserve The data of the collateral reserve
   * @param debtReserve The data of the debt reserve
   * @param collateralAsset The address of the underlying asset used as collateral, to receive as result of the liquidation
   * @param debtAsset The address of the underlying borrowed asset to be repaid with the liquidation
   * @param debtToCover The debt amount of borrowed `asset` the liquidator wants to cover
   * @param userCollateralBalance The collateral balance for the specific `collateralAsset` of the user being liquidated
   * @return collateralAmount: The maximum amount that is possible to liquidate given all the liquidation constraints
   *                           (user balance, close factor)
   *         debtAmountNeeded: The amount to repay with the liquidation
   **/
  function _calculateAvailableCollateralToLiquidate(
    DataTypes.ReserveData storage collateralReserve,
    DataTypes.ReserveData storage debtReserve,
    address collateralAsset,
    address debtAsset,
    uint256 debtToCover,
    uint256 userCollateralBalance
  ) private view returns (uint256, uint256) {
    uint256 collateralAmount = 0;
    uint256 debtAmountNeeded = 0;
    IPriceOracleGetter oracle = IPriceOracleGetter(_addressesProvider.getPriceOracle());

    AvailableCollateralToLiquidateLocalVars memory vars;

    vars.collateralPrice = oracle.getAssetPrice(collateralAsset);
    vars.debtAssetPrice = oracle.getAssetPrice(debtAsset);

    (, , vars.liquidationBonus, vars.collateralDecimals, ) = collateralReserve
      .configuration
      .getParams();
    vars.debtAssetDecimals = debtReserve.configuration.getDecimals();

    // This is the maximum possible amount of the selected collateral that can be liquidated, given the
    // max amount of liquidatable debt
    vars.maxAmountCollateralToLiquidate = vars
      .debtAssetPrice
      .mul(debtToCover)
      .mul(10**vars.collateralDecimals)
      .percentMul(vars.liquidationBonus)
      .div(vars.collateralPrice.mul(10**vars.debtAssetDecimals));

    if (vars.maxAmountCollateralToLiquidate > userCollateralBalance) {
      collateralAmount = userCollateralBalance;
      debtAmountNeeded = vars
        .collateralPrice
        .mul(collateralAmount)
        .mul(10**vars.debtAssetDecimals)
        .div(vars.debtAssetPrice.mul(10**vars.collateralDecimals))
        .percentDiv(vars.liquidationBonus);
    } else {
      collateralAmount = vars.maxAmountCollateralToLiquidate;
      debtAmountNeeded = debtToCover;
    }
    return (collateralAmount, debtAmountNeeded);
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external override countFlashloan {
    _flashLoan(
      receiver,
      assets,
      amounts,
      modes,
      onBehalfOf,
      params,
      referral,
      _flashLoanPremiumPct
    );
  }

  function sponsoredFlashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external override countFlashloan {
    _flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referral, 0);
  }

  modifier countFlashloan {
    require(_nestedCalls < type(uint8).max, Errors.LP_TOO_MANY_NESTED_CALLS);
    _nestedCalls++;
    _;
    _nestedCalls--;
  }

  struct FlashLoanLocalVars {
    IFlashLoanReceiver receiver;
    address currentAsset;
    address currentDepositToken;
    uint256 currentAmount;
    uint256 currentPremium;
    uint256 currentAmountPlusPremium;
    uint256[] premiums;
    uint256 referral;
    address onBehalfOf;
    uint16 premium;
    uint8 i;
  }

  function _flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral,
    uint16 flPremium
  ) private {
    FlashLoanLocalVars memory vars;
    ValidationLogic.validateFlashloan(assets, amounts);

    (vars.receiver, vars.referral, vars.onBehalfOf, vars.premium) = (
      IFlashLoanReceiver(receiver),
      referral,
      onBehalfOf,
      flPremium
    );

    vars.premiums = _flashLoanPre(address(vars.receiver), assets, amounts, vars.premium);

    require(
      vars.receiver.executeOperation(assets, amounts, vars.premiums, msg.sender, params),
      Errors.LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN
    );

    _flashLoanPost(vars, assets, amounts, modes, vars.premiums);
  }

  function _flashLoanPre(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint16 flashLoanPremium
  ) private returns (uint256[] memory premiums) {
    premiums = new uint256[](assets.length);

    for (uint256 i = 0; i < assets.length; i++) {
      premiums[i] = amounts[i].percentMul(flashLoanPremium);
      IDepositToken(_reserves[assets[i]].aTokenAddress).transferUnderlyingTo(
        receiverAddress,
        amounts[i]
      );
    }

    return premiums;
  }

  function _flashLoanPost(
    FlashLoanLocalVars memory vars,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    uint256[] memory premiums
  ) private {
    for (vars.i = 0; vars.i < assets.length; vars.i++) {
      vars.currentAsset = assets[vars.i];
      vars.currentAmount = amounts[vars.i];
      vars.currentPremium = premiums[vars.i];
      vars.currentDepositToken = _reserves[vars.currentAsset].aTokenAddress;
      vars.currentAmountPlusPremium = vars.currentAmount.add(vars.currentPremium);

      if (DataTypes.InterestRateMode(modes[vars.i]) == DataTypes.InterestRateMode.NONE) {
        _flashLoanRetrieve(vars);
      } else {
        // If the user chose to not return the funds, the system checks if there is enough collateral and
        // eventually opens a debt position
        _executeBorrow(
          ExecuteBorrowParams(
            vars.currentAsset,
            msg.sender,
            vars.onBehalfOf,
            vars.currentAmount,
            modes[vars.i],
            vars.currentDepositToken,
            vars.referral,
            false
          )
        );
      }
      emit FlashLoan(
        address(vars.receiver),
        msg.sender,
        vars.currentAsset,
        vars.currentAmount,
        vars.currentPremium,
        vars.referral
      );
    }
  }

  function _flashLoanRetrieve(FlashLoanLocalVars memory vars) private {
    _reserves[vars.currentAsset].updateState(vars.currentAsset);
    _reserves[vars.currentAsset].cumulateToLiquidityIndex(
      IERC20(vars.currentDepositToken).totalSupply(),
      vars.currentPremium
    );
    _reserves[vars.currentAsset].updateInterestRates(
      vars.currentAsset,
      vars.currentDepositToken,
      vars.currentAmountPlusPremium,
      0
    );

    IERC20(vars.currentAsset).safeTransferFrom(
      address(vars.receiver),
      vars.currentDepositToken,
      vars.currentAmountPlusPremium
    );
  }

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint256 referral,
    address onBehalfOf
  ) external override {
    (bool ok, string memory errMsg) =
      _executeBorrow(
        ExecuteBorrowParams(
          asset,
          msg.sender,
          onBehalfOf,
          amount,
          interestRateMode,
          _reserves[asset].aTokenAddress,
          referral,
          true
        )
      );
    require(ok, errMsg);
  }

  struct ExecuteBorrowParams {
    address asset;
    address user;
    address onBehalfOf;
    uint256 amount;
    uint256 interestRateMode;
    address aTokenAddress;
    uint256 referral;
    bool releaseUnderlying;
  }

  struct ExecuteBorrowVars {
    address oracle;
    uint256 amountInETH;
  }

  function _executeBorrow(ExecuteBorrowParams memory vars) private returns (bool, string memory) {
    DataTypes.ReserveData storage reserve = _reserves[vars.asset];
    DataTypes.UserConfigurationMap storage userConfig = _usersConfig[vars.onBehalfOf];

    ExecuteBorrowVars memory v;

    v.oracle = _addressesProvider.getPriceOracle();
    v.amountInETH = IPriceOracleGetter(v.oracle).getAssetPrice(vars.asset).mul(vars.amount).div(
      10**reserve.configuration.getDecimals()
    );

    ValidationLogic.validateBorrow(
      vars.asset,
      reserve,
      vars.onBehalfOf,
      vars.amount,
      v.amountInETH,
      vars.interestRateMode,
      _maxStableRateBorrowSizePct,
      _reserves,
      userConfig,
      _reservesList,
      _reservesCount,
      v.oracle
    );

    reserve.updateState(vars.asset);

    uint256 currentStableRate = 0;

    bool isFirstBorrowing = false;
    if (DataTypes.InterestRateMode(vars.interestRateMode) == DataTypes.InterestRateMode.STABLE) {
      currentStableRate = reserve.currentStableBorrowRate;

      isFirstBorrowing = IStableDebtToken(reserve.stableDebtTokenAddress).mint(
        vars.user,
        vars.onBehalfOf,
        vars.amount,
        currentStableRate
      );
    } else {
      isFirstBorrowing = IVariableDebtToken(reserve.variableDebtTokenAddress).mint(
        vars.user,
        vars.onBehalfOf,
        vars.amount,
        reserve.variableBorrowIndex
      );
    }

    if (isFirstBorrowing) {
      userConfig.setBorrowing(reserve.id, true);
    }

    reserve.updateInterestRates(
      vars.asset,
      vars.aTokenAddress,
      0,
      vars.releaseUnderlying ? vars.amount : 0
    );

    if (vars.releaseUnderlying) {
      IDepositToken(vars.aTokenAddress).transferUnderlyingTo(vars.user, vars.amount);
    }

    emit Borrow(
      vars.asset,
      vars.user,
      vars.onBehalfOf,
      vars.amount,
      vars.interestRateMode,
      DataTypes.InterestRateMode(vars.interestRateMode) == DataTypes.InterestRateMode.STABLE
        ? currentStableRate
        : reserve.currentVariableBorrowRate,
      vars.referral
    );

    return (true, '');
  }
}
