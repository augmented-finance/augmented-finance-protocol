// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../../../interfaces/ICreditDelegationToken.sol';
import '../../../tools/tokens/ERC20NoTransferBase.sol';
import './RewardedTokenBase.sol';

/// @dev Base contract for a non-transferrable debt tokens: StableDebtToken and VariableDebtToken
abstract contract DebtTokenBase is RewardedTokenBase, ERC20NoTransferBase, ICreditDelegationToken {
  mapping(address => mapping(address => uint256)) internal _borrowAllowances;

  /**
   * @dev delegates borrowing power to a user on the specific debt token
   * @param delegatee the address receiving the delegated borrowing power
   * @param amount the maximum amount being delegated. Delegation will still
   * respect the liquidation constraints (even if delegated, a delegatee cannot
   * force a delegator HF to go below 1)
   **/
  function approveDelegation(address delegatee, uint256 amount) external override {
    _borrowAllowances[msg.sender][delegatee] = amount;
    emit BorrowAllowanceDelegated(msg.sender, delegatee, _underlyingAsset, amount);
  }

  /**
   * @dev returns the borrow allowance of the user
   * @param fromUser The user to giving allowance
   * @param toUser The user to give allowance to
   * @return the current allowance of toUser
   **/
  function borrowAllowance(address fromUser, address toUser) external view override returns (uint256) {
    return _borrowAllowances[fromUser][toUser];
  }

  function _decreaseBorrowAllowance(
    address delegator,
    address delegatee,
    uint256 amount
  ) internal {
    uint256 limit = _borrowAllowances[delegator][delegatee];
    require(limit >= amount, Errors.BORROW_ALLOWANCE_NOT_ENOUGH);
    unchecked {
      limit -= amount;
    }
    _borrowAllowances[delegator][delegatee] = limit;
    emit BorrowAllowanceDelegated(delegator, delegatee, _underlyingAsset, limit);
  }
}
