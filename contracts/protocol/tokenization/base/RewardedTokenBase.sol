// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../tools/Errors.sol';
import '../../../reward/calcs/CalcLinearWeightedReward.sol';

import '../../../interfaces/IRewardedToken.sol';
import '../../../interfaces/IBalanceHook.sol';

import 'hardhat/console.sol';

abstract contract RewardedTokenBase is IERC20, IRewardedToken, CalcLinearWeightedReward {
  function totalSupply() public view virtual override returns (uint256) {
    return internalGetTotalSupply();
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return getRewardEntry(account).rewardBase;
  }

  function _setIncentivesController(address) internal {
    _mutable();
    revert('UNSUPPORTED');
  }

  function _mutable() private {}

  function getIncentivesController() public view override returns (address) {
    return address(this);
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalAllocatedReward(
    address,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal virtual {
    // if (allocated == 0 && mode == AllocationMode.Push) {
    //   return;
    // }
    // console.log('allocate', allocated, since, uint256(mode));
  }

  function _incrementBalance(address account, uint256 amount) private {
    (uint256 allocated, uint32 since, AllocationMode mode) = doIncrementRewardBalance(account, amount);
    internalAllocatedReward(account, allocated, since, mode);
  }

  function _decrementBalance(address account, uint256 amount) private {
    // require(oldAccountBalance >= amount, 'ERC20: burn amount exceeds balance');
    (uint256 allocated, uint32 since, AllocationMode mode) = doDecrementRewardBalance(account, amount);
    internalAllocatedReward(account, allocated, since, mode);
  }

  function incrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal {
    doIncrementTotalSupply(amount);
    _incrementBalance(account, amount);
  }

  function decrementBalance(
    address account,
    uint256 amount,
    uint256
  ) internal {
    // require(oldAccountBalance >= amount, 'ERC20: burn amount exceeds balance');
    doDecrementTotalSupply(amount);
    _decrementBalance(account, amount);
  }

  function incrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256,
    uint256 total
  ) internal {
    doUpdateTotalSupply(total);
    _incrementBalance(account, amount);
  }

  function decrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256,
    uint256 total
  ) internal {
    doUpdateTotalSupply(total);
    _decrementBalance(account, amount);
  }

  function transferBalance(
    address sender,
    address recipient,
    uint256 amount,
    uint256
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);
    if (sender != recipient) {
      // require(oldSenderBalance >= amount, 'ERC20: transfer amount exceeds balance');
      _decrementBalance(sender, amount);
      _incrementBalance(recipient, amount);
    }
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}
}
