// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {ISubscriptionAdapter} from '../interfaces/ISubscriptionAdapter.sol';
import {IRedeemableToken, IWithdrawablePool} from './IRedeemableToken.sol';
import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';

import 'hardhat/console.sol';

contract AaveAdapter is ISubscriptionAdapter, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IRedeemableToken private _originAsset;
  uint256 private _totalScaledDeposited;
  uint256 private _totalScaledMigrated;
  mapping(address => uint256) private _deposits;

  IMigratorRewardController private _rewardController;
  uint256 private _rewardFactor;

  /// @dev _exchangeFactor is nominated in rays
  uint256 private _exchangeFactor;
  ILendableToken private _targetAsset;

  bool private _depositPaused;
  bool private _claimAllowed;

  constructor(
    address originAsset,
    IMigratorRewardController rewardController,
    uint256 rewardFactor
  ) public {
    _originAsset = IRedeemableToken(originAsset);
    _rewardController = rewardController;
    _rewardFactor = rewardFactor;

    require(
      IERC20(_originAsset.UNDERLYING_ASSET_ADDRESS()).totalSupply() > 0,
      'invalid underlying'
    );
    require(address(_originAsset.POOL()) != address(0), 'unknown asset pool');
    require(address(_rewardController) != address(0), 'unknown rewardController');
  }

  function ORIGIN_ASSET_ADDRESS() external view override returns (address) {
    return address(_originAsset);
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return _originAsset.UNDERLYING_ASSET_ADDRESS();
  }

  function REWARD_CONTROLLER_ADDRESS() external view returns (address) {
    return address(_rewardController);
  }

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external override notMigrated returns (uint256) {
    require(holder != address(0), 'holder is required');
    uint256 scaledAmount = _originAsset.scaledBalanceOf(address(this));
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);
    scaledAmount = scaledAmount.sub(_originAsset.scaledBalanceOf(address(this)));

    _deposits[holder] = _deposits[holder].add(scaledAmount);
    _totalScaledDeposited += scaledAmount;

    _rewardController.depositForMigrateIncreased(amount, holder, _rewardFactor, referralCode);
    return amount;
  }

  function withdrawFromMigrate(uint256 amount) external override notMigrated returns (uint256) {
    return _withdrawFromMigrate(amount, msg.sender);
  }

  function isClaimable() external view override returns (bool) {
    return (address(_targetAsset) != address(0)) && _claimAllowed;
  }

  function claimMigrated(address holder) external override returns (uint256) {
    return claimMigratedPortion(holder, 1);
  }

  /// @dev claimMigratedPortion is a backup solution for large deposits
  function claimMigratedPortion(address holder, uint256 divisor)
    public
    claimable
    returns (uint256 amount)
  {
    uint256 scaledAmount = _deposits[holder] / divisor;
    if (scaledAmount == 0) {
      return 0;
    }
    _deposits[holder] -= scaledAmount;

    uint256 factor =
      _targetAsset.POOL().getReserveNormalizedIncome(_targetAsset.UNDERLYING_ASSET_ADDRESS());
    amount = scaledAmount.rayMul(factor);
    IERC20(_targetAsset).safeTransfer(holder, amount);
    return amount;
  }

  function admin_setRewardFactor(uint256 rewardFactor) external override onlyOwner {
    _rewardFactor = rewardFactor;
  }

  function admin_enableClaims() external override onlyOwner migrated {
    _claimAllowed = true;
  }

  function admin_migrateAll(ILendableToken targetAsset) external override onlyOwner notMigrated {
    address underlying = _originAsset.UNDERLYING_ASSET_ADDRESS();
    require(targetAsset.UNDERLYING_ASSET_ADDRESS() == underlying, 'mismatched underlying');
    _targetAsset = targetAsset;

    IWithdrawablePool fromPool = _originAsset.POOL();

    // IERC20(_originAsset).approve(pool, _totalScaledDeposited);
    uint256 underlyingAmount = IERC20(underlying).balanceOf(address(this));
    // IERC20(underlying).approve(pool, _totalScaledDeposited);
    uint256 withdrawnAmount = fromPool.withdraw(underlying, type(uint256).max, address(this));
    underlyingAmount = IERC20(underlying).balanceOf(address(this)).sub(underlyingAmount);
    require(underlyingAmount >= withdrawnAmount, 'withdrawn less than expected');

    if (withdrawnAmount == 0) {
      require(_totalScaledDeposited == 0, 'withdrawn zero when deposited non zero');
      _totalScaledMigrated = 1;
      return;
    }

    ILendablePool toPool = targetAsset.POOL();
    uint256 targetAmount = targetAsset.scaledBalanceOf(address(this));
    toPool.deposit(underlying, withdrawnAmount, address(this), 0);
    targetAmount = targetAsset.scaledBalanceOf(address(this)).sub(targetAmount);
    require(targetAmount > 0, 'deposited less than expected');
    _totalScaledMigrated = targetAmount;
  }

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder)
    external
    override
    onlyOwner
    notMigrated
    returns (uint256)
  {
    require(holder != address(0), 'holder is required');
    return _withdrawFromMigrate(amount, holder);
  }

  function balanceForMigrate(address holder) external view override returns (uint256) {
    return _balanceForMigrate(holder);
  }

  function totalBalanceForMigrate() external view returns (uint256) {
    return _totalScaledDeposited;
  }

  function _withdrawFromMigrate(uint256 amount, address holder)
    private
    notMigrated
    returns (uint256)
  {
    uint256 maxAmount = _balanceForMigrate(holder);
    if (maxAmount == 0) {
      return 0;
    }
    if (amount > maxAmount) {
      amount = maxAmount;
    }

    uint256 scaledAmount = _originAsset.scaledBalanceOf(address(this));
    IERC20(_originAsset).safeTransfer(holder, amount);
    scaledAmount = _originAsset.scaledBalanceOf(address(this)).sub(scaledAmount);

    _totalScaledDeposited -= scaledAmount;
    if (amount == maxAmount) {
      _rewardController.depositForMigrateRemoved(holder);
      delete (_deposits[holder]);
      return amount;
    }

    _deposits[holder] = _deposits[holder].sub(scaledAmount);
    _rewardController.depositForMigrateDecreased(amount, holder, _rewardFactor);
    return amount;
  }

  function _balanceForMigrate(address holder) private view returns (uint256) {
    uint256 scaledAmount = _deposits[holder];
    if (scaledAmount == 0) {
      return 0;
    }
    return scaledAmount.rayMul(getNormalizedIncome());
  }

  function getNormalizedIncome() private view returns (uint256) {
    return _originAsset.POOL().getReserveNormalizedIncome(_originAsset.UNDERLYING_ASSET_ADDRESS());
  }

  modifier notMigrated() {
    require(address(_targetAsset) == address(0), 'migrating or migrated');
    _;
  }

  modifier migrated() {
    require(address(_targetAsset) != address(0), 'not migrated');
    _;
  }

  modifier claimable() {
    require((address(_targetAsset) != address(0)) && _claimAllowed, 'not claimable');
    _;
  }
}
