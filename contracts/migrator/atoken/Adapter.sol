// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

import {BasicAdapter} from '../interfaces/BasicAdapter.sol';
import {IRedeemableToken, IWithdrawablePool} from './IRedeemableToken.sol';
import {IMigratorRewardController} from '../interfaces/IRewardDispenser.sol';

import 'hardhat/console.sol';

contract AaveAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  constructor(
    IRedeemableToken originAsset,
    IMigratorRewardController rewardController,
    uint256 rewardFactor
  ) public BasicAdapter(address(originAsset), rewardController, rewardFactor) {
    require(IERC20(originAsset.UNDERLYING_ASSET_ADDRESS()).totalSupply() > 0, 'invalid underlying');
    require(address(originAsset.POOL()) != address(0), 'unknown asset pool');
  }

  function getUnderlying() internal view override returns (address) {
    return IRedeemableToken(_originAsset).UNDERLYING_ASSET_ADDRESS();
  }

  function transferOriginIn(uint256 amount, address holder)
    internal
    override
    returns (uint256 internalAmount)
  {
    internalAmount = IRedeemableToken(_originAsset).scaledBalanceOf(address(this));
    IERC20(_originAsset).safeTransferFrom(holder, address(this), amount);
    return IRedeemableToken(_originAsset).scaledBalanceOf(address(this)).sub(internalAmount);
  }

  function transferOriginOut(uint256 amount, address holder)
    internal
    override
    returns (uint256 internalAmount)
  {
    internalAmount = IRedeemableToken(_originAsset).scaledBalanceOf(address(this));
    IERC20(_originAsset).safeTransfer(holder, amount);
    return internalAmount.sub(IRedeemableToken(_originAsset).scaledBalanceOf(address(this)));
  }

  function transferTargetOut(uint256 internalAmount, address holder)
    internal
    override
    returns (uint256 userAmount)
  {
    userAmount = internalAmount.rayMul(getNormalizeTargetFactor());
    IERC20(_targetAsset).safeTransfer(holder, userAmount);
    return userAmount;
  }

  function getOriginBalance(address holder) internal view override returns (uint256 amount) {
    uint256 scaledAmount = _deposits[holder];
    if (scaledAmount == 0) {
      return 0;
    }
    return scaledAmount.rayMul(getNormalizeOriginFactor());
  }

  function totalBalanceForMigrate() external view override returns (uint256) {
    if (_totalDeposited == 0) {
      return 0;
    }
    return _totalDeposited.rayMul(getNormalizeOriginFactor());
  }

  function withdrawUnderlyingFromOrigin(address underlying)
    internal
    override
    returns (uint256 amount)
  {
    IWithdrawablePool fromPool = IRedeemableToken(_originAsset).POOL();

    uint256 underlyingAmount = IERC20(underlying).balanceOf(address(this));
    uint256 withdrawnAmount = fromPool.withdraw(underlying, type(uint256).max, address(this));
    underlyingAmount = IERC20(underlying).balanceOf(address(this)).sub(underlyingAmount);
    require(underlyingAmount >= withdrawnAmount, 'withdrawn less than expected');
    return withdrawnAmount;
  }

  function getNormalizeOriginFactor() private view returns (uint256) {
    return
      IRedeemableToken(_originAsset).POOL().getReserveNormalizedIncome(
        IRedeemableToken(_originAsset).UNDERLYING_ASSET_ADDRESS()
      );
  }
}
