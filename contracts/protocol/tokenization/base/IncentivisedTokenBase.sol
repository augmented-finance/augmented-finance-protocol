// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../tools/Errors.sol';
import '../../../interfaces/IRewardedToken.sol';
import '../../../interfaces/IBalanceHook.sol';

abstract contract IncentivisedTokenBase is IERC20, IRewardedToken {
  uint256 private _totalSupply;
  mapping(address => uint256) private _balances;

  IBalanceHook private _incentivesController;
  bool internal _useScaledBalanceUpdate;

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function _setIncentivesController(address hook) internal virtual {
    _incentivesController = IBalanceHook(hook);
    _useScaledBalanceUpdate = (hook != address(0)) && IBalanceHook(hook).isScaledBalanceUpdateNeeded();
  }

  function getIncentivesController() public view override returns (address) {
    return address(_incentivesController);
  }

  function _incrementBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    uint256 oldAccountBalance = _balances[account];

    uint256 total = _totalSupply + amount;
    _totalSupply = total;

    amount += oldAccountBalance;

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, total, scale);
  }

  function _decrementBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    require(oldAccountBalance >= amount, 'ERC20: amount exceeds balance');

    uint256 total = _totalSupply - amount;
    _totalSupply = total;

    unchecked {
      amount = oldAccountBalance - amount;
    }

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, total, scale);
  }

  function _incrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256 scale,
    uint256 total
  ) internal {
    uint256 oldAccountBalance = _balances[account];

    _totalSupply = total;
    amount += oldAccountBalance;

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, total, scale);
  }

  function _decrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256 scale,
    uint256 total
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    require(oldAccountBalance >= amount, 'ERC20: amount exceeds balance');

    _totalSupply = total;
    unchecked {
      amount = oldAccountBalance - amount;
    }

    _balances[account] = amount;
    handleScaledBalanceUpdate(account, oldAccountBalance, amount, total, scale);
  }

  function _transferBalance(
    address sender,
    address recipient,
    uint256 amount,
    uint256 scale
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 oldRecipientBalance = _balances[recipient];
    uint256 newRecipientBalance = oldRecipientBalance + amount;

    uint256 oldSenderBalance = _balances[sender];
    require(oldSenderBalance >= amount, 'ERC20: transfer amount exceeds balance');
    uint256 newSenderBalance;
    unchecked {
      newSenderBalance = oldSenderBalance - amount;
    }

    _balances[sender] = newSenderBalance;
    _balances[recipient] = newRecipientBalance;

    IBalanceHook hook = _incentivesController;
    if (address(hook) != address(0)) {
      uint256 currentTotalSupply = _totalSupply;

      hook.handleScaledBalanceUpdate(
        address(this),
        sender,
        oldSenderBalance,
        newSenderBalance,
        currentTotalSupply,
        scale
      );

      if (sender != recipient) {
        hook.handleScaledBalanceUpdate(
          address(this),
          recipient,
          oldRecipientBalance,
          newRecipientBalance,
          currentTotalSupply,
          scale
        );
      }
    }
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 providerSupply
  ) internal virtual {
    IBalanceHook hook = _incentivesController;
    if (hook == IBalanceHook(address(0))) {
      return;
    }
    hook.handleBalanceUpdate(address(this), holder, oldBalance, newBalance, providerSupply);
  }

  function handleScaledBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 providerSupply,
    uint256 scale
  ) internal {
    IBalanceHook hook = _incentivesController;
    if (hook == IBalanceHook(address(0))) {
      return;
    }
    hook.handleScaledBalanceUpdate(address(this), holder, oldBalance, newBalance, providerSupply, scale);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}
}
