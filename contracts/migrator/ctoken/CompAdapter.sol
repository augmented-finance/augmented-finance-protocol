// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {ILendableToken} from '../interfaces/ILendableToken.sol';
import {BasicAdapter} from '../BasicAdapter.sol';
import {IRedeemableToken} from './IRedeemableToken.sol';

import '../../dependencies/compound-protocol/contracts/Exponential.sol';

import 'hardhat/console.sol';

contract CompAdapter is BasicAdapter, Exponential {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _originScaleOnMigrate;

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

  function toOriginInternalBalance(uint256 userAmount) internal view override returns (uint256) {
    return userAmount;
  }

  function toOriginUserBalance(uint256 internalAmount) internal view override returns (uint256) {
    return internalAmount;
  }

  function withdrawUnderlyingFromOrigin()
    internal
    override
    returns (uint256 internalAmount, uint256 underlyingAmount)
  {
    IERC20 underlying = IERC20(_underlying);
    IRedeemableToken origin = IRedeemableToken(_originAsset);

    underlyingAmount = underlying.balanceOf(address(this));

    internalAmount = origin.balanceOf(address(this));
    require(_totalDeposited <= internalAmount, 'available less than deposited');

    if (internalAmount == 0) {
      return (0, 0);
    }

    require(origin.redeem(internalAmount) == 0, 'unexpected Compound error');
    underlyingAmount = underlying.balanceOf(address(this)).sub(underlyingAmount);

    require(origin.balanceOf(address(this)) == 0, 'incomplete withdrawal');

    return (internalAmount, underlyingAmount);
  }

  function getNormalizeOriginFactor() private view returns (uint256) {
    Exp memory exchangeRate = Exp({mantissa: IRedeemableToken(_originAsset).exchangeRateStored()});
    (MathError mErr, uint256 factor) = mulScalarTruncate(exchangeRate, WadRayMath.RAY);
    require(mErr == MathError.NO_ERROR, 'origin factor could not be calculated');
    return factor;
  }

  function internalMigrateAll(ILendableToken target) internal override {
    _originScaleOnMigrate = getNormalizeOriginFactor();
    super.internalMigrateAll(target);
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newTotalDeposited
  ) internal override {
    if (internalIsMigrated()) {
      _rewardPool.handleScaledBalanceUpdate(
        _underlying,
        holder,
        oldBalance,
        newBalance,
        newTotalDeposited,
        _originScaleOnMigrate
      );
      return;
    }

    _rewardPool.handleScaledBalanceUpdate(
      _underlying,
      holder,
      oldBalance,
      newBalance,
      newTotalDeposited,
      getNormalizeOriginFactor()
    );
  }
}
