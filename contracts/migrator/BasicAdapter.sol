// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Address} from '../dependencies/openzeppelin/contracts/Address.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';

import {IMigrationAdapter} from './interfaces/IMigrationAdapter.sol';
import {ILendableToken, ILendablePool} from './interfaces/ILendableToken.sol';
import {IBalanceHook} from '../interfaces/IBalanceHook.sol';

import 'hardhat/console.sol';

abstract contract BasicAdapter is IMigrationAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  address private _controller;

  address internal _originAsset;
  address internal _underlying;
  uint256 internal _totalDeposited;

  mapping(address => uint256) internal _deposits;

  IBalanceHook internal _rewardPool;

  ILendableToken internal _targetAsset;
  ILendablePool internal _targetPool;
  uint256 internal _totalMigrated;
  uint256 internal _totalClaimed;

  bool private _paused;
  bool private _claimAllowed;

  constructor(
    address controller,
    address originAsset,
    address underlying
  ) public {
    require(IERC20(originAsset).totalSupply() > 0, 'invalid origin');
    _originAsset = originAsset;
    _controller = controller;
    _underlying = underlying;
  }

  function ORIGIN_ASSET_ADDRESS() external view override returns (address) {
    return _originAsset;
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return _underlying;
  }

  function getRewardPool() public view override returns (address) {
    return address(_rewardPool);
  }

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external override notMigrated notPaused returns (uint256) {
    require(holder != address(0), 'holder is required');
    referralCode;

    uint256 internalAmount = transferOriginIn(amount, holder);
    uint256 oldBalance = _deposits[holder];
    uint256 newBalance = oldBalance.add(internalAmount);
    _deposits[holder] = newBalance;
    uint256 newTotalDeposited = _totalDeposited.add(internalAmount);
    _totalDeposited = newTotalDeposited;

    if (address(_rewardPool) != address(0)) {
      handleBalanceUpdate(holder, oldBalance, newBalance, newTotalDeposited);
    }
    return amount;
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newTotalDeposited
  ) internal virtual;

  function withdrawFromMigrate(uint256 amount) external override returns (uint256) {
    return privateWithdrawFromMigrate(amount, msg.sender);
  }

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder)
    external
    override
    onlyController
    returns (uint256)
  {
    require(holder != address(0), 'holder is required');
    return privateWithdrawFromMigrate(amount, holder);
  }

  function balanceForMigrate(address holder) external view override returns (uint256) {
    return toOriginUserBalance(_deposits[holder]);
  }

  function isClaimable() external view override returns (bool) {
    return internalIsClaimable();
  }

  function claimMigrated(address holder)
    external
    override
    notPaused
    returns (uint256 amount, bool claimable)
  {
    return privateClaimPortion(holder, 1);
  }

  /// @dev claimMigratedPortion is a backup solution for large deposits
  function claimMigratedPortion(address holder, uint256 divisor)
    external
    override
    notPaused
    returns (uint256 amount, bool claimable)
  {
    return privateClaimPortion(holder, divisor);
  }

  function privateClaimPortion(address holder, uint256 divisor) private returns (uint256, bool) {
    if (!internalIsClaimable()) {
      return (0, false);
    }

    uint256 oldBalance = _deposits[holder];
    if (oldBalance == 0) {
      return (0, true);
    }

    uint256 amount;
    uint256 newBalance;
    if (divisor > 1) {
      amount = oldBalance / divisor;
      if (amount == 0) {
        return (0, true);
      }

      newBalance = oldBalance - amount;
      _deposits[holder] = newBalance;
    } else {
      amount = oldBalance;
      delete (_deposits[holder]);
    }

    _totalClaimed += amount;
    if (_totalDeposited == 0) {
      amount = 0;
    } else {
      amount = amount.mul(_totalMigrated).div(_totalDeposited);
    }

    // hic! total for rewards shold stay constant after migration to preserve relative weights of rewards
    handleBalanceUpdate(holder, oldBalance, newBalance, _totalDeposited);

    return (transferTargetOut(amount, holder), true);
  }

  function balanceMigrated(address holder) external view override returns (uint256) {
    if (_totalDeposited == 0) {
      return 0;
    }
    return _deposits[holder].mul(_totalMigrated).div(_totalDeposited);
  }

  function totalBalanceForMigrate() external view returns (uint256) {
    if (_totalDeposited == 0) {
      return 0;
    }
    return toOriginUserBalance(_totalDeposited);
  }

  function totalScaledBalances()
    external
    view
    returns (
      uint256 totalDeposited,
      uint256 totalMigrated,
      uint256 totalClaimed,
      bool migrated
    )
  {
    return (_totalDeposited, _totalMigrated, _totalClaimed, internalIsMigrated());
  }

  function admin_setRewardPool(IBalanceHook rewardPool) external override onlyController {
    _rewardPool = rewardPool;
  }

  function admin_enableClaims() external override onlyController {
    _claimAllowed = true;
  }

  function admin_setPaused(bool paused) external override onlyController {
    _paused = paused;
  }

  function getController() public override returns (address) {
    return _controller;
  }

  function admin_migrateAll(ILendableToken targetAsset)
    external
    override
    onlyController
    notMigrated
  {
    internalMigrateAll(targetAsset);
  }

  function internalMigrateAll(ILendableToken targetAsset) internal virtual {
    require(targetAsset.UNDERLYING_ASSET_ADDRESS() == _underlying, 'mismatched underlying');

    (uint256 originAmount, uint256 underlyingAmount) = withdrawUnderlyingFromOrigin();

    ILendablePool toPool = targetAsset.POOL();
    _targetPool = toPool;

    if (originAmount == 0) {
      _totalMigrated = 0;
      // set last to make sure that "migrated" functions can't be invoked before it is done here
      _targetAsset = targetAsset;
      return;
    }
    require(underlyingAmount > 0, 'withdrawn no underlying');
    if (originAmount > _totalDeposited) {
      // something was sent directly?
      uint256 extraUnderlying =
        underlyingAmount.mul(originAmount - _totalDeposited).div(originAmount);
      if (extraUnderlying > 1) {
        // don't convert the excess futher, but keep it for sweep
        underlyingAmount -= extraUnderlying - 1; // -1 to compensate possible rounding error
      }
    }

    uint256 targetAmount = targetAsset.scaledBalanceOf(address(this));
    toPool.deposit(_underlying, underlyingAmount, address(this), 0);
    targetAmount = targetAsset.scaledBalanceOf(address(this)).sub(targetAmount);
    require(targetAmount > 0, 'deposited less than expected');
    _totalMigrated = targetAmount;

    // set last to make sure that "migrated" functions can't be invoked before it is done here
    _targetAsset = targetAsset;
  }

  /// @dev admin_sweepToken allows an owner to handle funds accidentially sent to this contract.
  /// For safety reasons:
  /// 1. target asset can not be swept after migration as there will be unclaimed funds.
  /// 2. origin and underlying assets can only be swept after migration (residuals).
  function admin_sweepToken(address token) external onlyController returns (uint256) {
    require(token != address(0), 'unknown token');

    if (internalIsMigrated()) {
      require(token != address(_targetAsset), 'target asset can not be swept after migration');
    } else {
      require(
        token != _underlying && token != _originAsset,
        'origin and underlying can only be swept after migration'
      );
    }

    uint256 amount = IERC20(token).balanceOf(address(this));
    if (amount > 0) {
      IERC20(token).safeTransfer(msg.sender, amount);
    }
    return amount;
  }

  function transferOriginIn(uint256 amount, address holder)
    internal
    virtual
    returns (uint256 internalAmount);

  function transferOriginOut(uint256 amount, address holder)
    internal
    virtual
    returns (uint256 internalAmount);

  function withdrawUnderlyingFromOrigin()
    internal
    virtual
    returns (uint256 originAmount, uint256 underlyingAmount);

  function privateWithdrawFromMigrate(uint256 amount, address holder)
    private
    notMigrated
    returns (uint256)
  {
    uint256 oldBalance = _deposits[holder];
    if (oldBalance == 0) {
      return 0;
    }

    uint256 newBalance = 0;
    uint256 newTotalDeposited = _totalDeposited;
    uint256 maxAmount = toOriginInternalBalance(oldBalance);

    if (amount >= maxAmount) {
      amount = maxAmount;
      delete (_deposits[holder]); // prevents recursion
      transferOriginOut(amount, holder);
      newTotalDeposited = newTotalDeposited.sub(oldBalance);
    } else {
      uint256 internalAmount = transferOriginOut(amount, holder);
      newBalance = oldBalance.sub(internalAmount, 'excess transfer'); // prevents recursion
      _deposits[holder] = newBalance;
      newTotalDeposited = newTotalDeposited.sub(internalAmount);
    }
    _totalDeposited = newTotalDeposited;

    if (address(_rewardPool) != address(0)) {
      handleBalanceUpdate(holder, oldBalance, newBalance, newTotalDeposited);
    }

    return amount;
  }

  function toOriginInternalBalance(uint256 userAmount)
    internal
    view
    virtual
    returns (uint256 internalAmount);

  function toOriginUserBalance(uint256 internalAmount)
    internal
    view
    virtual
    returns (uint256 userAmount);

  function toTargetUserBalance(uint256 internalAmount) internal view returns (uint256 userAmount) {
    return internalAmount.rayMul(getNormalizeTargetFactor());
  }

  function getNormalizeTargetFactor() private view returns (uint256) {
    return _targetPool.getReserveNormalizedIncome(_underlying);
  }

  function transferTargetOut(uint256 internalAmount, address holder)
    internal
    virtual
    returns (uint256 userAmount)
  {
    userAmount = toTargetUserBalance(internalAmount);
    IERC20(address(_targetAsset)).safeTransfer(holder, userAmount);
    return userAmount;
  }

  function internalIsClaimable() internal view returns (bool) {
    return internalIsMigrated() && _claimAllowed && !_paused;
  }

  function internalIsMigrated() internal view returns (bool) {
    return address(_targetAsset) != address(0);
  }

  modifier onlyController() {
    require(_controller == msg.sender, 'caller is not the controller');
    _;
  }

  modifier notMigrated() {
    require(address(_targetAsset) == address(0), 'migrating or migrated');
    _;
  }

  modifier migrated() {
    require(internalIsMigrated(), 'not migrated');
    _;
  }

  modifier notPaused() {
    require(!_paused, 'paused');
    _;
  }
}
