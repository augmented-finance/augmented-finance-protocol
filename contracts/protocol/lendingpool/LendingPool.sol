// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../../access/AccessHelper.sol';
import '../../interfaces/IDepositToken.sol';
import '../../interfaces/IVariableDebtToken.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/ILendingPoolForTokens.sol';
import '../../flashloan/interfaces/IFlashLoanReceiver.sol';
import '../../interfaces/IStableDebtToken.sol';
import '../../tools/upgradeability/Delegator.sol';
import '../../tools/Errors.sol';
import '../libraries/helpers/Helpers.sol';
import '../libraries/logic/GenericLogic.sol';
import '../libraries/logic/ValidationLogic.sol';
import '../libraries/logic/ReserveLogic.sol';
import '../libraries/types/DataTypes.sol';
import './LendingPoolBase.sol';

/**
 * @title LendingPool contract
 * @dev Main point of interaction with a protocol's market
 * - Users can:
 *   # Deposit
 *   # Withdraw
 *   # Borrow
 *   # Repay
 *   # Swap their loans between variable and stable rate
 *   # Enable/disable their deposits as collateral rebalance stable rate borrow positions
 *   # Liquidate positions
 *   # Execute Flash Loans
 **/
contract LendingPool is LendingPoolBase, ILendingPool, Delegator, ILendingPoolForTokens {
  using SafeERC20 for IERC20;
  using AccessHelper for IMarketAccessController;
  using ReserveLogic for DataTypes.ReserveData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  uint256 private constant POOL_REVISION = 0x1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  function initialize(IMarketAccessController provider) public initializer(POOL_REVISION) {
    _addressesProvider = provider;
    _maxStableRateBorrowSizePct = 25 * PercentageMath.PCT;
    _flashLoanPremiumPct = 9 * PercentageMath.BP;
  }

  fallback() external {
    // all IManagedLendingPool etc functions should be delegated to the extension
    _delegate(_extension);
  }

  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint256 referral
  ) public override whenNotPaused noReentryOrFlashloan {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateDeposit(reserve, amount);

    address depositToken = reserve.depositTokenAddress;

    uint256 liquidityIndex = reserve.updateStateForDeposit(asset);
    reserve.updateInterestRates(asset, depositToken, amount, 0);

    IERC20(asset).safeTransferFrom(msg.sender, depositToken, amount);

    bool isFirstDeposit = IDepositToken(depositToken).mint(onBehalfOf, amount, liquidityIndex);

    if (isFirstDeposit) {
      _usersConfig[onBehalfOf].setUsingAsCollateral(reserve.id, true);
      emit ReserveUsedAsCollateralEnabled(asset, onBehalfOf);
    }

    emit Deposit(asset, msg.sender, onBehalfOf, amount, referral);
  }

  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external override whenNotPaused noReentry returns (uint256) {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    address depositToken = reserve.depositTokenAddress;

    uint256 userBalance = IDepositToken(depositToken).balanceOf(msg.sender);

    uint256 amountToWithdraw = amount;

    if (amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(
      asset,
      amountToWithdraw,
      userBalance,
      _reserves,
      _usersConfig[msg.sender],
      _reservesList,
      _reservesCount,
      _addressesProvider.getPriceOracle()
    );

    uint256 liquidityIndex = reserve.updateStateForDeposit(asset);
    reserve.updateInterestRates(asset, depositToken, 0, amountToWithdraw);

    if (amountToWithdraw == userBalance) {
      _usersConfig[msg.sender].setUsingAsCollateral(reserve.id, false);
      emit ReserveUsedAsCollateralDisabled(asset, msg.sender);
    }

    IDepositToken(depositToken).burn(msg.sender, to, amountToWithdraw, liquidityIndex);

    emit Withdraw(asset, msg.sender, to, amountToWithdraw);

    return amountToWithdraw;
  }

  function borrow(
    address,
    uint256,
    uint256,
    uint256,
    address
  ) external override {
    // for compatibility with ILendingPool
    _delegate(_extension);
  }

  function repay(
    address asset,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external override whenNotPaused noReentry returns (uint256) {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(onBehalfOf, reserve);

    DataTypes.InterestRateMode interestRateMode = DataTypes.InterestRateMode(rateMode);

    ValidationLogic.validateRepay(
      reserve,
      amount,
      interestRateMode,
      onBehalfOf,
      stableDebt,
      variableDebt
    );

    uint256 paybackAmount =
      interestRateMode == DataTypes.InterestRateMode.STABLE ? stableDebt : variableDebt;

    if (amount < paybackAmount) {
      paybackAmount = amount;
    }

    reserve.updateState(asset);

    if (interestRateMode == DataTypes.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(onBehalfOf, paybackAmount);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(
        onBehalfOf,
        paybackAmount,
        reserve.variableBorrowIndex
      );
    }

    address depositToken = reserve.depositTokenAddress;
    reserve.updateInterestRates(asset, depositToken, paybackAmount, 0);

    if (stableDebt + variableDebt <= paybackAmount) {
      _usersConfig[onBehalfOf].setBorrowing(reserve.id, false);
    }

    IERC20(asset).safeTransferFrom(msg.sender, depositToken, paybackAmount);

    IDepositToken(depositToken).handleRepayment(msg.sender, paybackAmount);

    emit Repay(asset, onBehalfOf, msg.sender, paybackAmount);

    return paybackAmount;
  }

  function swapBorrowRateMode(address asset, uint256 rateMode)
    external
    override
    whenNotPaused
    noReentryOrFlashloan
  {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(msg.sender, reserve);

    DataTypes.InterestRateMode interestRateMode = DataTypes.InterestRateMode(rateMode);

    ValidationLogic.validateSwapRateMode(
      reserve,
      _usersConfig[msg.sender],
      stableDebt,
      variableDebt,
      interestRateMode
    );

    reserve.updateState(asset);

    if (interestRateMode == DataTypes.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(msg.sender, stableDebt);
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(
        msg.sender,
        msg.sender,
        stableDebt,
        reserve.variableBorrowIndex
      );
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(
        msg.sender,
        variableDebt,
        reserve.variableBorrowIndex
      );
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(
        msg.sender,
        msg.sender,
        variableDebt,
        reserve.currentStableBorrowRate
      );
    }

    reserve.updateInterestRates(asset, reserve.depositTokenAddress, 0, 0);

    emit Swap(asset, msg.sender, rateMode);
  }

  function rebalanceStableBorrowRate(address asset, address user)
    external
    override
    whenNotPaused
    noReentryOrFlashloan
  {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    IERC20 stableDebtToken = IERC20(reserve.stableDebtTokenAddress);
    IERC20 variableDebtToken = IERC20(reserve.variableDebtTokenAddress);
    address depositToken = reserve.depositTokenAddress;

    uint256 stableDebt = IERC20(stableDebtToken).balanceOf(user);

    ValidationLogic.validateRebalanceStableBorrowRate(
      reserve,
      asset,
      stableDebtToken,
      variableDebtToken,
      depositToken
    );

    reserve.updateState(asset);

    IStableDebtToken(address(stableDebtToken)).burn(user, stableDebt);
    IStableDebtToken(address(stableDebtToken)).mint(
      user,
      user,
      stableDebt,
      reserve.currentStableBorrowRate
    );

    reserve.updateInterestRates(asset, depositToken, 0, 0);

    emit RebalanceStableBorrowRate(asset, user);
  }

  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)
    external
    override
    whenNotPaused
  {
    DataTypes.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateSetUseReserveAsCollateral(
      reserve,
      asset,
      useAsCollateral,
      _reserves,
      _usersConfig[msg.sender],
      _reservesList,
      _reservesCount,
      _addressesProvider.getPriceOracle()
    );

    _usersConfig[msg.sender].setUsingAsCollateral(reserve.id, useAsCollateral);

    if (useAsCollateral) {
      emit ReserveUsedAsCollateralEnabled(asset, msg.sender);
    } else {
      emit ReserveUsedAsCollateralDisabled(asset, msg.sender);
    }
  }

  function liquidationCall(
    address,
    address,
    address,
    uint256,
    bool
  ) external override {
    // for compatibility with ILendingPool
    _delegate(_extension);
  }

  function flashLoan(
    address,
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata,
    uint256
  ) external override {
    // for compatibility with ILendingPool
    _delegate(_extension);
  }

  function getReserveData(address asset)
    external
    view
    override(ILendingPool, ILendingPoolForTokens)
    returns (DataTypes.ReserveData memory)
  {
    return _reserves[asset];
  }

  function getUserAccountData(address user)
    external
    view
    override
    returns (
      uint256 totalCollateralETH,
      uint256 totalDebtETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    )
  {
    (
      totalCollateralETH,
      totalDebtETH,
      ltv,
      currentLiquidationThreshold,
      healthFactor
    ) = GenericLogic.calculateUserAccountData(
      user,
      _reserves,
      _usersConfig[user],
      _reservesList,
      _reservesCount,
      _addressesProvider.getPriceOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(
      totalCollateralETH,
      totalDebtETH,
      ltv
    );
  }

  function getConfiguration(address asset)
    external
    view
    override(ILendingPool, ILendingPoolForTokens)
    returns (DataTypes.ReserveConfigurationMap memory)
  {
    return _reserves[asset].configuration;
  }

  function getUserConfiguration(address user)
    external
    view
    override
    returns (DataTypes.UserConfigurationMap memory)
  {
    return _usersConfig[user];
  }

  function getReserveNormalizedIncome(address asset)
    external
    view
    virtual
    override(ILendingPool, ILendingPoolForTokens)
    returns (uint256)
  {
    return _reserves[asset].getNormalizedIncome(asset);
  }

  function getReserveNormalizedVariableDebt(address asset)
    external
    view
    override(ILendingPool, ILendingPoolForTokens)
    returns (uint256)
  {
    return _reserves[asset].getNormalizedDebt();
  }

  function getReservesList() external view override returns (address[] memory) {
    address[] memory _activeReserves = new address[](_reservesCount);

    for (uint256 i = 0; i < _reservesCount; i++) {
      _activeReserves[i] = _reservesList[i];
    }
    return _activeReserves;
  }

  function getAccessController() external view override returns (IMarketAccessController) {
    return _addressesProvider;
  }

  /// @dev Returns the percentage of available liquidity that can be borrowed at once at stable rate
  function MAX_STABLE_RATE_BORROW_SIZE_PERCENT() public view returns (uint256) {
    return _maxStableRateBorrowSizePct;
  }

  /// @dev Returns the fee of flash loans - backward compatible
  function FLASHLOAN_PREMIUM_TOTAL() public view returns (uint256) {
    return _flashLoanPremiumPct;
  }

  function getFlashloanPremiumPct() public view override returns (uint16) {
    return _flashLoanPremiumPct;
  }

  function getAddressesProvider() external view override returns (address) {
    return address(_addressesProvider);
  }

  /// @dev Returns the address of the LendingPoolExtension
  function getLendingPoolExtension() external view returns (address) {
    return _extension;
  }

  /// @dev Updates the address of the LendingPoolExtension
  function setLendingPoolExtension(address extension) external onlyConfiguratorOrAdmin {
    require(Address.isContract(extension), Errors.VL_CONTRACT_REQUIRED);
    _extension = extension;
    emit LendingPoolExtensionUpdated(extension);
  }

  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromBefore,
    uint256 balanceToBefore
  ) external override whenNotPaused {
    require(
      msg.sender == _reserves[asset].depositTokenAddress,
      Errors.LP_CALLER_MUST_BE_DEPOSIT_TOKEN
    );

    ValidationLogic.validateTransfer(
      from,
      _reserves,
      _usersConfig[from],
      _reservesList,
      _reservesCount,
      _addressesProvider.getPriceOracle()
    );

    uint256 reserveId = _reserves[asset].id;

    if (from != to) {
      if (balanceFromBefore <= amount) {
        DataTypes.UserConfigurationMap storage fromConfig = _usersConfig[from];
        fromConfig.setUsingAsCollateral(reserveId, false);
        emit ReserveUsedAsCollateralDisabled(asset, from);
      }

      if (balanceToBefore == 0 && amount != 0) {
        DataTypes.UserConfigurationMap storage toConfig = _usersConfig[to];
        toConfig.setUsingAsCollateral(reserveId, true);
        emit ReserveUsedAsCollateralEnabled(asset, to);
      }
    }
  }
}
