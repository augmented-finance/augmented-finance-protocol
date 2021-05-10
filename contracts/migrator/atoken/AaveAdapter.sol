// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {BasicAdapter} from '../BasicAdapter.sol';
import {IRedeemableToken, IWithdrawablePool} from './IRedeemableToken.sol';

import 'hardhat/console.sol';

contract AaveAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IWithdrawablePool private _originPool;
  uint256 private _originScaleOnMigrate;

  constructor(address controller, IRedeemableToken originAsset)
    public
    BasicAdapter(controller, address(originAsset), originAsset.UNDERLYING_ASSET_ADDRESS())
  {
    _originPool = originAsset.POOL();
    require(address(_originPool) != address(0), 'unknown asset pool');
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

  function toOriginInternalBalance(uint256 userAmount) internal view override returns (uint256) {
    return userAmount.rayDiv(getNormalizeOriginFactor());
  }

  function toOriginUserBalance(uint256 internalAmount) internal view override returns (uint256) {
    return internalAmount.rayMul(getNormalizeOriginFactor());
  }

  function withdrawUnderlyingFromOrigin()
    internal
    override
    returns (uint256 internalAmount, uint256 underlyingAmount)
  {
    IERC20 underlying = IERC20(_underlying);
    IRedeemableToken origin = IRedeemableToken(_originAsset);

    internalAmount = origin.scaledBalanceOf(address(this));
    require(_totalDeposited <= internalAmount, 'available less than deposited');

    underlyingAmount = underlying.balanceOf(address(this));

    uint256 originAmount =
      _originPool.withdraw(address(underlying), type(uint256).max, address(this));
    underlyingAmount = underlying.balanceOf(address(this)).sub(underlyingAmount);

    require(underlyingAmount >> 1 == originAmount >> 1, 'inconsistent withdrawal');
    require(origin.scaledBalanceOf(address(this)) == 0, 'incomplete withdrawal');

    return (internalAmount, underlyingAmount);
  }

  function getNormalizeOriginFactor() private view returns (uint256) {
    return _originPool.getReserveNormalizedIncome(_underlying);
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
