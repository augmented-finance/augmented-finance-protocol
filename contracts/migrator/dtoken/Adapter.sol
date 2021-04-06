// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {ISubscriptionAdapter} from '../interfaces/ISubscriptionAdapter.sol';
import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';

import 'hardhat/console.sol';

abstract contract DeadTokenAdapter is ISubscriptionAdapter, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IERC20 private _originAsset;
  uint256 private _totalDeposited;
  mapping(address => uint256) private _deposits;

  IMigratorRewardController private _rewardController;
  uint256 private _rewardFactor;

  bool private _depositPaused;

  constructor(
    address originAsset,
    IMigratorRewardController rewardController,
    uint256 rewardFactor
  ) public {
    _originAsset = IERC20(originAsset);
    _rewardController = rewardController;
    _rewardFactor = rewardFactor;

    require(_originAsset.totalSupply() > 0, 'invalid asset');
    require(address(_rewardController) != address(0), 'unknown rewardController');
  }

  function ORIGIN_ASSET_ADDRESS() external view override returns (address) {
    return address(_originAsset);
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_originAsset);
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
    _originAsset.safeTransferFrom(holder, address(this), amount);
    _deposits[holder] = _deposits[holder].add(amount);

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
    _totalDeposited;
    return true;
  }

  function claimMigrated(address holder) external override returns (uint256) {
    return claimMigratedPortion(holder, 1);
  }

  /// @dev claimMigratedPortion is a backup solution for large deposits
  function claimMigratedPortion(address, uint256) public claimable returns (uint256) {
    _totalDeposited += 0;
    return 0;
  }

  function admin_setRewardFactor(uint256 rewardFactor) external override onlyOwner {
    _rewardFactor = rewardFactor;
  }

  function admin_enableClaims() external override onlyOwner migrated {}

  function admin_migrateAll(ILendableToken) external override onlyOwner notMigrated {}

  function _withdrawFromMigrate(uint256 amount, address holder) private returns (uint256) {
    uint256 maxAmount = _balanceForMigrate(holder);
    if (maxAmount == 0) {
      return 0;
    }
    if (amount > maxAmount) {
      amount = maxAmount;
    }
    _originAsset.safeTransfer(holder, amount);

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
    _;
  }

  modifier migrated() {
    _;
  }

  modifier claimable() {
    _;
  }
}
