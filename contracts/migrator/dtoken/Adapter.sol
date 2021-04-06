// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Address} from '../../dependencies/openzeppelin/contracts/Address.sol';

import {BasicAdapter} from '../interfaces/BasicAdapter.sol';
import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';

import 'hardhat/console.sol';

contract DeadTokenAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor(
    address originAsset,
    IMigratorRewardController rewardController,
    uint256 rewardFactor
  ) public BasicAdapter(originAsset, rewardController, rewardFactor) {}

  function getUnderlying() internal view override returns (address) {
    return address(_originAsset);
  }

  function transferOriginIn(uint256 amount, address holder) internal override returns (uint256) {
    require(Address.isExternallyOwned(holder), 'only users are allowed, but not contracts');
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);
    return amount;
  }

  function transferOriginOut(uint256 amount, address holder) internal override returns (uint256) {
    IERC20(_originAsset).safeTransfer(holder, amount);
    return amount;
  }

  function transferTargetOut(uint256, address) internal override returns (uint256) {
    return 0;
  }

  function getOriginBalance(address holder) internal view override returns (uint256) {
    return _deposits[holder];
  }

  function totalBalanceForMigrate() external view override returns (uint256) {
    return _totalDeposited;
  }

  function withdrawUnderlyingFromOrigin(address) internal override returns (uint256) {
    revert('migrate is not allowed');
  }
}
