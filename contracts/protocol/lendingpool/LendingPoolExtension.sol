// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../interfaces/IDepositToken.sol';
import '../../interfaces/IStableDebtToken.sol';
import '../../interfaces/IVariableDebtToken.sol';
import '../../interfaces/IPriceOracleGetter.sol';
import '../../interfaces/ILendingPoolExtension.sol';
import '../../interfaces/ILendingPoolEvents.sol';
import '../../interfaces/IManagedLendingPool.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import '../../tools/Errors.sol';
import '../../flashloan/interfaces/IFlashLoanReceiver.sol';
import '../../access/AccessFlags.sol';
import '../libraries/logic/GenericLogic.sol';
import '../libraries/helpers/Helpers.sol';
import '../libraries/logic/ValidationLogic.sol';
import '../libraries/logic/ReserveLogic.sol';
import '../libraries/types/DataTypes.sol';
import './LendingPoolBase.sol';

/// @dev Delegatee of LendingPool for borrow, flashloan, collateral etc. Runs via delegateCall, retain storage layout
/// WARNING! This contract runs via delegateCall and must have a compatible storage layout with LendingPool.
contract LendingPoolExtension is LendingPoolBase, ILendingPoolExtension, ILendingPoolEvents, IManagedLendingPool {
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using ReserveLogic for DataTypes.ReserveData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;
  using AccessHelper for IMarketAccessController;

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
    IDepositToken collateralDepositToken;
    bool isCollateralEnabled;
    DataTypes.InterestRateMode borrowRateMode;
  }

  /// @dev This should never be called
  function getRevision() internal pure override returns (uint256) {
    revert('IMPOSSIBLE');
  }

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveDeposit
  ) external override whenNotPaused {
    require(_disabledFeatures & FEATURE_LIQUIDATION == 0, Errors.LP_RESTRICTED_FEATURE);

    DataTypes.ReserveData storage collateralReserve = _reserves[collateralAsset];
    DataTypes.ReserveData storage debtReserve = _reserves[debtAsset];
    DataTypes.UserConfigurationMap storage userConfig = _usersConfig[user];

    LiquidationCallLocalVars memory vars;

    (, , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
      user,
      _reserves,
      userConfig,
      _reservesList,
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

    vars.collateralDepositToken = IDepositToken(collateralReserve.depositTokenAddress);

    vars.userCollateralBalance = vars.collateralDepositToken.collateralBalanceOf(user);

    vars.maxLiquidatableDebt = (vars.userStableDebt + vars.userVariableDebt).percentMul(
      LIQUIDATION_CLOSE_FACTOR_PERCENT
    );

    vars.actualDebtToLiquidate = debtToCover > vars.maxLiquidatableDebt ? vars.maxLiquidatableDebt : debtToCover;

    (vars.maxCollateralToLiquidate, vars.debtAmountNeeded) = _calculateAvailableCollateralToLiquidate(
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
    if (!receiveDeposit) {
      uint256 currentAvailableCollateral = IERC20(collateralAsset).balanceOf(address(vars.collateralDepositToken));
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
        vars.actualDebtToLiquidate - vars.userVariableDebt
      );
    }

    debtReserve.updateInterestRates(debtAsset, debtReserve.depositTokenAddress, vars.actualDebtToLiquidate, 0);

    if (receiveDeposit) {
      uint256 liquidityIndex = collateralReserve.getNormalizedIncome(collateralAsset);

      if (
        vars.collateralDepositToken.transferOnLiquidation(
          user,
          msg.sender,
          vars.maxCollateralToLiquidate,
          liquidityIndex,
          false
        )
      ) {
        DataTypes.UserConfigurationMap storage liquidatorConfig = _usersConfig[msg.sender];
        liquidatorConfig.setUsingAsCollateral(collateralReserve.id);
        emit ReserveUsedAsCollateralEnabled(collateralAsset, msg.sender);
      }
    } else {
      uint256 liquidityIndex = collateralReserve.updateStateForDeposit(collateralAsset);
      collateralReserve.updateInterestRates(
        collateralAsset,
        address(vars.collateralDepositToken),
        0,
        vars.maxCollateralToLiquidate
      );

      vars.collateralDepositToken.transferOnLiquidation(
        user,
        msg.sender,
        vars.maxCollateralToLiquidate,
        liquidityIndex,
        true
      );
    }

    // If the collateral being liquidated is equal to the user balance,
    // we set the currency as not being used as collateral anymore
    if (vars.maxCollateralToLiquidate == vars.userCollateralBalance) {
      userConfig.unsetUsingAsCollateral(collateralReserve.id);
      emit ReserveUsedAsCollateralDisabled(collateralAsset, user);
    }

    // Transfers the debt asset being repaid to the depostToken, where the liquidity is kept
    IERC20(debtAsset).safeTransferFrom(msg.sender, debtReserve.depositTokenAddress, vars.actualDebtToLiquidate);

    emit LiquidationCall(
      collateralAsset,
      debtAsset,
      user,
      vars.actualDebtToLiquidate,
      vars.maxCollateralToLiquidate,
      msg.sender,
      receiveDeposit
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

    (, , vars.liquidationBonus, vars.collateralDecimals, ) = collateralReserve.configuration.getParams();
    vars.debtAssetDecimals = debtReserve.configuration.getDecimals();

    // This is the maximum possible amount of the selected collateral that can be liquidated, given the
    // max amount of liquidatable debt
    vars.maxAmountCollateralToLiquidate =
      (vars.debtAssetPrice * debtToCover * (10**vars.collateralDecimals)).percentMul(vars.liquidationBonus) /
      (vars.collateralPrice * (10**vars.debtAssetDecimals));

    if (vars.maxAmountCollateralToLiquidate > userCollateralBalance) {
      collateralAmount = userCollateralBalance;
      debtAmountNeeded = ((vars.collateralPrice * collateralAmount * (10**vars.debtAssetDecimals)) /
        (vars.debtAssetPrice * (10**vars.collateralDecimals))).percentDiv(vars.liquidationBonus);
    } else {
      collateralAmount = vars.maxAmountCollateralToLiquidate;
      debtAmountNeeded = debtToCover;
    }
    return (collateralAmount, debtAmountNeeded);
  }

  function _checkUntrustedFlashloan() private view {
    require(_disabledFeatures & FEATURE_FLASHLOAN == 0, Errors.LP_RESTRICTED_FEATURE);
    require(_flashloanCalls == 0, Errors.LP_TOO_MANY_FLASHLOAN_CALLS);
    require(_nestedCalls == 0, Errors.LP_TOO_MANY_NESTED_CALLS);
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external override whenNotPaused {
    _checkUntrustedFlashloan();
    _flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referral, _flashLoanPremiumPct);
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referral
  ) external override whenNotPaused {
    _checkUntrustedFlashloan();
    _flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referral, _flashLoanPremiumPct);
  }

  function trustedFlashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external override {
    // whenNotPaused is NOT applied as the pool can be paused by the liquidity manager
    // _checkUntrustedFlashloan() is NOT applied to allow any lending pool operations from the receiver
    _addressesProvider.requireAnyOf(
      msg.sender,
      AccessFlags.TRUSTED_FLASHLOAN | AccessFlags.LIQUIDITY_CONTROLLER,
      Errors.LP_IS_NOT_TRUSTED_FLASHLOAN
    );
    require(_flashloanCalls < type(uint8).max, Errors.LP_TOO_MANY_FLASHLOAN_CALLS);

    _flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referral, 0);
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
    require(Address.isContract(receiver), Errors.VL_CONTRACT_REQUIRED);
    _flashloanCalls++;
    {
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
    _flashloanCalls--;
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
      IDepositToken(_reserves[assets[i]].depositTokenAddress).transferUnderlyingTo(receiverAddress, amounts[i]);
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
      vars.currentDepositToken = _reserves[vars.currentAsset].depositTokenAddress;
      vars.currentAmountPlusPremium = vars.currentAmount + vars.currentPremium;

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
  ) external override whenNotPaused noReentryOrFlashloanFeature(FEATURE_FLASHLOAN_BORROW) {
    _executeBorrow(
      ExecuteBorrowParams(
        asset,
        msg.sender,
        onBehalfOf,
        amount,
        interestRateMode,
        _reserves[asset].depositTokenAddress,
        referral,
        true
      )
    );
  }

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referral,
    address onBehalfOf
  ) external override whenNotPaused noReentryOrFlashloanFeature(FEATURE_FLASHLOAN_BORROW) {
    _executeBorrow(
      ExecuteBorrowParams(
        asset,
        msg.sender,
        onBehalfOf,
        amount,
        interestRateMode,
        _reserves[asset].depositTokenAddress,
        referral,
        true
      )
    );
  }

  struct ExecuteBorrowParams {
    address asset;
    address user;
    address onBehalfOf;
    uint256 amount;
    uint256 interestRateMode;
    address depositToken;
    uint256 referral;
    bool releaseUnderlying;
  }

  struct ExecuteBorrowVars {
    address oracle;
    uint256 amountInETH;
  }

  function _executeBorrow(ExecuteBorrowParams memory vars) private {
    DataTypes.ReserveData storage reserve = _reserves[vars.asset];
    DataTypes.UserConfigurationMap storage userConfig = _usersConfig[vars.onBehalfOf];

    ExecuteBorrowVars memory v;

    v.oracle = _addressesProvider.getPriceOracle();
    v.amountInETH =
      (IPriceOracleGetter(v.oracle).getAssetPrice(vars.asset) * vars.amount) /
      (10**reserve.configuration.getDecimals());

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
      userConfig.setBorrowing(reserve.id);
    }

    reserve.updateInterestRates(vars.asset, vars.depositToken, 0, vars.releaseUnderlying ? vars.amount : 0);
    if (vars.releaseUnderlying) {
      IDepositToken(vars.depositToken).transferUnderlyingTo(vars.user, vars.amount);
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
  }

  function setReserveStrategy(
    address asset,
    address strategy,
    bool isExternal
  ) external override onlyLendingPoolConfigurator {
    _checkReserve(asset);
    require(isExternal = IReserveStrategy(strategy).isDelegatedReserve());
    if (_reserves[asset].strategy != address(0)) {
      require(isExternal == _reserves[asset].configuration.isExternalStrategy());
    } else {
      DataTypes.ReserveConfigurationMap memory cfg = _reserves[asset].configuration;
      cfg.setExternalStrategy(isExternal);
      _reserves[asset].configuration = cfg;
    }
    _reserves[asset].strategy = strategy;
  }

  function _checkReserve(address asset) private view {
    require(_reserves[asset].depositTokenAddress != address(0), Errors.VL_UNKNOWN_RESERVE);
  }

  function setConfiguration(address asset, uint256 configuration) external override onlyLendingPoolConfigurator {
    _checkReserve(asset);
    _reserves[asset].configuration.data = configuration;
  }

  function setFlashLoanPremium(uint16 premium) external onlyConfiguratorOrAdmin {
    require(premium <= PercentageMath.ONE && premium > 0, Errors.LP_INVALID_PERCENTAGE);
    _flashLoanPremiumPct = premium;
    emit FlashLoanPremiumUpdated(premium);
  }

  function _addReserveToList(address asset) internal {
    uint256 reservesCount = _reservesCount;
    require(reservesCount < _maxNumberOfReserves, Errors.LP_NO_MORE_RESERVES_ALLOWED);

    bool reserveAlreadyAdded = _reserves[asset].id != 0 || _reservesList[0] == asset;

    if (!reserveAlreadyAdded) {
      _reserves[asset].id = uint8(reservesCount);
      _reservesList[reservesCount] = asset;

      _reservesCount = uint8(reservesCount) + 1;
    }
  }

  function setDisabledFeatures(uint16 disabledFeatures) external override onlyConfiguratorOrAdmin {
    _disabledFeatures = disabledFeatures;
    emit DisabledFeaturesUpdated(disabledFeatures);
  }

  function getDisabledFeatures() external view override returns (uint16 disabledFeatures) {
    return _disabledFeatures;
  }

  /// @dev Initializes a reserve, activates it, assigns an deposit and debt tokens and an interest rate strategy
  function initReserve(DataTypes.InitReserveData calldata data) external override onlyLendingPoolConfigurator {
    require(Address.isContract(data.asset), Errors.VL_CONTRACT_REQUIRED);
    _reserves[data.asset].init(data);
    _addReserveToList(data.asset);

    if (data.externalStrategy) {
      address underlying = IReserveDelegatedStrategy(data.strategy).getUnderlying(data.asset);
      require(underlying != address(0));
      if (underlying != data.asset) {
        _indirectUnderlying[underlying].push(data.asset);
      }
    }
  }

  function getLendingPoolExtension() external view override returns (address) {
    return _extension;
  }

  function setLendingPoolExtension(address extension) external override onlyConfiguratorOrAdmin {
    require(Address.isContract(extension), Errors.VL_CONTRACT_REQUIRED);
    _extension = extension;
    emit LendingPoolExtensionUpdated(extension);
  }
}
