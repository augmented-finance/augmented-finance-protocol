// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../tools/Errors.sol';
import '../../../reward/calcs/CalcLinearRewardBalances.sol';
import '../../../interfaces/IBalanceHook.sol';

abstract contract RewardedTokenBase is IERC20, CalcLinearRewardBalances {
  uint256 private _totalSupply;

  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view override returns (uint256) {
    return getRewardEntry(account).rewardBase;
  }

  function internalAllocatedReward(
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal virtual {}

  function incrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal virtual {
    (uint256 allocated, uint32 since, AllocationMode mode) = doIncrementRewardBalance(account, amount);
    internalAllocatedReward(allocated, since, mode);
  }

  function decrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal virtual {
    // require(oldAccountBalance >= amount, 'ERC20: burn amount exceeds balance');
    (uint256 allocated, uint32 since, AllocationMode mode) = doDecrementRewardBalance(account, amount);
    internalAllocatedReward(allocated, since, mode);
  }

  // function internalBalanceUndeflowError() internal view override {
  //   revert('balance underflow');
  // }

  function _transferBalance(
    address sender,
    address recipient,
    uint256 amount,
    uint256 scale
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);
    if (sender != recipient) {
      // require(oldSenderBalance >= amount, 'ERC20: transfer amount exceeds balance');
      decrementBalance(sender, amount, scale);
      incrementBalance(recipient, amount, scale);
    }
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}
}
