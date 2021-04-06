// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {ISubscriptionAdapter} from '../interfaces/ISubscriptionAdapter.sol';
import {IRedeemableToken} from './IRedeemableToken.sol';
import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';

import 'hardhat/console.sol';

contract CompAdapter is ISubscriptionAdapter, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  IRedeemableToken private _originAsset;
  IERC20 private _underlyingAsset;
  uint256 private _totalDeposited;
  mapping(address => uint256) private _deposits;

  IMigratorRewardController private _rewardController;
  uint256 private _rewardFactor;

  ILendableToken private _targetAsset;
  uint256 private _totalMigrated;

  bool private _depositPaused;
  bool private _claimAllowed;

  constructor(
    address originAsset,
    address underlyingAsset,
    IMigratorRewardController rewardController,
    uint256 rewardFactor
  ) public {
    _originAsset = IRedeemableToken(originAsset);
    _underlyingAsset = IERC20(underlyingAsset);
    _rewardController = rewardController;
    _rewardFactor = rewardFactor;

    require(_underlyingAsset.totalSupply() > 0, 'invalid underlying');
    require(address(_originAsset) != address(0), 'unknown asset');
    require(_originAsset.totalSupply() > 0, 'invalid asset');
    require(address(_rewardController) != address(0), 'unknown rewardController');
  }

  function ORIGIN_ASSET_ADDRESS() external view override returns (address) {
    return address(_originAsset);
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_underlyingAsset);
  }

  function REWARD_CONTROLLER_ADDRESS() external view returns (address) {
    return address(_rewardController);
  }

  function _setRewardFactor(uint256 rewardFactor) external onlyOwner {
    _rewardFactor = rewardFactor;
  }

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external override notMigrated returns (uint256) {
    require(holder != address(0), 'holder is required');
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);

    _deposits[holder] = _deposits[holder].add(amount);
    _totalDeposited = _totalDeposited.add(amount);

    _rewardController.depositForMigrateIncreased(amount, holder, _rewardFactor, referralCode);
    return amount;
  }

  function withdrawFromMigrate(uint256 amount) external override returns (uint256) {
    return _withdrawFromMigrate(amount, msg.sender);
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
    return _totalDeposited;
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
    amount = _deposits[holder] / divisor;
    if (amount == 0) {
      return 0;
    }
    _deposits[holder] -= amount;

    amount = amount.mul(_totalMigrated).div(_totalDeposited);
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
    address underlying = address(_underlyingAsset);
    require(targetAsset.UNDERLYING_ASSET_ADDRESS() == underlying, 'mismatched underlying');
    _targetAsset = targetAsset;

    // IERC20(_originAsset).approve(pool, _totalDeposited);
    uint256 underlyingAmount = IERC20(underlying).balanceOf(address(this));
    // IERC20(underlying).approve(pool, _totalDeposited);
    uint256 withdrawnAmount = _originAsset.redeem(_originAsset.balanceOf(address(this)));
    underlyingAmount = IERC20(underlying).balanceOf(address(this)).sub(underlyingAmount);
    require(underlyingAmount >= withdrawnAmount, 'withdrawn less than expected');

    if (withdrawnAmount == 0) {
      require(_totalDeposited == 0, 'withdrawn zero when deposited non zero');
      _totalMigrated = 1;
      return;
    }

    ILendablePool toPool = targetAsset.POOL();
    uint256 targetAmount = targetAsset.scaledBalanceOf(address(this));
    toPool.deposit(underlying, withdrawnAmount, address(this), 0);
    targetAmount = targetAsset.scaledBalanceOf(address(this)).sub(targetAmount);
    require(targetAmount > 0, 'deposited less than expected');
    _totalMigrated = targetAmount;
  }

  function _withdrawFromMigrate(uint256 amount, address holder) private returns (uint256) {
    uint256 maxAmount = _balanceForMigrate(holder);
    if (maxAmount == 0) {
      return 0;
    }
    if (amount > maxAmount) {
      amount = maxAmount;
    }

    IERC20(_originAsset).safeTransfer(holder, amount);
    _totalDeposited = _totalDeposited.sub(amount);

    if (amount == maxAmount) {
      _rewardController.depositForMigrateRemoved(holder);
      delete (_deposits[holder]);
      return amount;
    }

    _deposits[holder] = _deposits[holder].sub(amount);
    _rewardController.depositForMigrateDecreased(amount, holder, _rewardFactor);
    return amount;
  }

  function _balanceForMigrate(address holder) private view returns (uint256) {
    return _deposits[holder];
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
