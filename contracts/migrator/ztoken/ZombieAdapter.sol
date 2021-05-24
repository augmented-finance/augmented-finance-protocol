// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Address} from '../../dependencies/openzeppelin/contracts/Address.sol';

import {BasicAdapter} from '../BasicAdapter.sol';
import {ILendableToken, ILendablePool} from '../interfaces/ILendableToken.sol';

import 'hardhat/console.sol';

contract ZombieAdapter is BasicAdapter {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor(address controller, address originAsset)
    public
    BasicAdapter(controller, originAsset, originAsset)
  {}

  function balanceOrigin() internal override returns (uint256 internalAmount) {
    return IERC20(_originAsset).balanceOf(address(this));
  }

  function internalDeposit(
    address holder,
    uint256 internalAmount,
    uint256 amount,
    uint64 referralCode
  ) internal override returns (uint256) {
    require(Address.isExternallyOwned(holder), 'only users are allowed, but not contracts');
    return super.internalDeposit(holder, internalAmount, amount, referralCode);
  }

  function transferOriginOut(uint256 amount, address holder) internal override returns (uint256) {
    IERC20(_originAsset).safeTransfer(holder, amount);
    return amount;
  }

  function transferTargetOut(uint256, address) internal override returns (uint256) {
    return 0;
  }

  function toOriginInternalBalance(uint256 userAmount) internal view override returns (uint256) {
    return userAmount;
  }

  function toOriginUserBalance(uint256 internalAmount) internal view override returns (uint256) {
    return internalAmount;
  }

  function withdrawUnderlyingFromOrigin() internal override returns (uint256, uint256) {
    return (_totalDeposited, 0);
  }

  function internalMigrateAll(ILendableToken) internal override {
    _targetAsset = ILendableToken(address(this)); // mark migration
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 newTotalDeposited
  ) internal override {
    _rewardPool.handleBalanceUpdate(_underlying, holder, oldBalance, newBalance, newTotalDeposited);
  }
}
