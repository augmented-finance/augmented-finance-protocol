// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';
import {BasicAdapter} from '../interfaces/BasicAdapter.sol';
import {IRedeemableToken, IWithdrawablePool} from './IRedeemableToken.sol';

import 'hardhat/console.sol';

contract AaveAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IWithdrawablePool private _originPool;

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

  function transferTargetOut(uint256 internalAmount, address holder)
    internal
    override
    returns (uint256 userAmount)
  {
    userAmount = internalAmount.rayMul(getNormalizeTargetFactor());
    IERC20(address(_targetAsset)).safeTransfer(holder, userAmount);
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

  function withdrawUnderlyingFromOrigin() internal override returns (uint256 amount) {
    IERC20 underlying = IERC20(_underlying);

    uint256 underlyingAmount = underlying.balanceOf(address(this));
    uint256 withdrawnAmount =
      _originPool.withdraw(address(underlying), type(uint256).max, address(this));
    underlyingAmount = underlying.balanceOf(address(this)).sub(underlyingAmount);
    // TODO: limit withdrawl
    require(underlyingAmount >= withdrawnAmount, 'withdrawn less than expected');
    return withdrawnAmount;
  }

  function getNormalizeOriginFactor() private view returns (uint256) {
    return _originPool.getReserveNormalizedIncome(_underlying);
  }
}
