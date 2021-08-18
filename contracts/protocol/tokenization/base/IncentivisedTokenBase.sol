// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../access/interfaces/IMarketAccessController.sol';
import '../../../tools/Errors.sol';
import '../../../interfaces/IRewardedToken.sol';
import '../../../interfaces/IBalanceHook.sol';
import './PoolTokenBase.sol';

abstract contract IncentivisedTokenBase is PoolTokenBase {
  uint256 private _totalSupply;
  mapping(address => uint256) private _balances;

  IBalanceHook private _incentivesController;

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function internalSetIncentivesController(address hook) internal override {
    _incentivesController = IBalanceHook(hook);
    //    _useScaledBalanceUpdate = (hook != address(0)) && IBalanceHook(hook).isScaledBalanceUpdateNeeded();
  }

  function getIncentivesController() public view override returns (address) {
    return address(_incentivesController);
  }

  function internalIncrementBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal override {
    uint256 oldAccountBalance = _balances[account];
    amount += oldAccountBalance;

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, scale);
  }

  function internalDecrementBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal override {
    uint256 oldAccountBalance = _balances[account];
    require(oldAccountBalance >= amount, 'ERC20: amount exceeds balance');

    unchecked {
      amount = oldAccountBalance - amount;
    }

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, scale);
  }

  function internalUpdateTotalSupply(uint256 newTotal) internal override {
    _totalSupply = newTotal;
  }

  // function handleBalanceUpdate(
  //   address holder,
  //   uint256 oldBalance,
  //   uint256 newBalance,
  //   uint256 providerSupply
  // ) internal virtual {
  //   IBalanceHook hook = _incentivesController;
  //   if (hook == IBalanceHook(address(0))) {
  //     return;
  //   }
  //   hook.handleBalanceUpdate(address(this), holder, oldBalance, newBalance, providerSupply);
  // }

  function handleScaledBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 scale
  ) internal {
    IBalanceHook hook = _incentivesController;
    if (hook == IBalanceHook(address(0))) {
      return;
    }
    hook.handleScaledBalanceUpdate(address(this), holder, oldBalance, newBalance, _totalSupply, scale);
  }
}
