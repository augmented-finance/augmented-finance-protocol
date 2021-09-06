// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';

abstract contract ERC20BalanceBase is IERC20 {
  mapping(address => uint256) private _balances;

  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account];
  }

  function incrementBalance(address account, uint256 amount) internal virtual {
    _balances[account] += amount;
  }

  function decrementBalance(address account, uint256 amount) internal virtual {
    uint256 balance = _balances[account];
    require(balance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[account] = balance - amount;
    }
  }
}
