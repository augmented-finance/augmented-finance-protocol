// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {ISubscriptionAdapter} from '../interfaces/ISubscriptionAdapter.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';
import {IRedeemableToken} from './IRedeemableToken.sol';

import 'hardhat/console.sol';

abstract contract CompAdapter is ISubscriptionAdapter, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  mapping(address => uint256) private _deposits;
  IRedeemableToken private _originAsset;
  IERC20 private _underlyingAsset;
  IMigratorRewardController private _rewardController;
  uint256 private _rewardFactor;

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
  ) external override returns (uint256) {
    require(holder != address(0), 'holder is required');
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);

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
    returns (uint256)
  {
    require(holder != address(0), 'holder is required');
    return _withdrawFromMigrate(amount, holder);
  }

  function balanceForMigrate(address holder) external view override returns (uint256) {
    return _balanceForMigrate(holder);
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
}
