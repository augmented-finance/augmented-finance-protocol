// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';

import {BasicAdapter} from '../interfaces/BasicAdapter.sol';
import {IRedeemableToken} from './IRedeemableToken.sol';

import 'hardhat/console.sol';

contract CompAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor(
    address controller,
    address originAsset,
    address underlyingAsset
  ) public BasicAdapter(controller, originAsset, underlyingAsset) {}

  function transferOriginIn(uint256 amount, address holder) internal override returns (uint256) {
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);
    return amount;
  }

  function transferOriginOut(uint256 amount, address holder) internal override returns (uint256) {
    IERC20(_originAsset).safeTransfer(holder, amount);
    return amount;
  }

  function transferTargetOut(uint256 amount, address holder) internal override returns (uint256) {
    IERC20(address(_targetAsset)).safeTransfer(holder, amount);
    return amount;
  }

  function getOriginBalance(address holder) internal view override returns (uint256 amount) {
    return _deposits[holder];
  }

  function totalBalanceForMigrate() external view override returns (uint256) {
    return _totalDeposited;
  }

  function withdrawUnderlyingFromOrigin() internal override returns (uint256 amount) {
    IERC20 underlying = IERC20(_underlying);

    uint256 underlyingAmount = underlying.balanceOf(address(this));
    uint256 withdrawnAmount =
      IRedeemableToken(_originAsset).redeem( // _totalDeposited
        IRedeemableToken(_originAsset).balanceOf(address(this))
      );
    underlyingAmount = underlying.balanceOf(address(this)).sub(underlyingAmount);
    require(underlyingAmount >= withdrawnAmount, 'withdrawn less than expected');
    return withdrawnAmount;
  }
}