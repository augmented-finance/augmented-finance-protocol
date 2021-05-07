// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {ICreditDelegationToken} from '../../../interfaces/ICreditDelegationToken.sol';
import {VersionedInitializable} from '../../../tools/upgradeability/VersionedInitializable.sol';
import {IncentivizedERC20} from './IncentivizedERC20.sol';
import {PoolTokenConfig} from '../interfaces/PoolTokenConfig.sol';
import {IBalanceHook} from '../../../interfaces/IBalanceHook.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {PoolTokenBase} from './PoolTokenBase.sol';

/**
 * @title DebtTokenBase
 * @notice Base contract for debt tokens: StableDebtToken and VariableDebtToken
 */

abstract contract DebtTokenBase is
  IncentivizedERC20('DEBT_STUB', 'DEBT_STUB', 0),
  PoolTokenBase,
  VersionedInitializable,
  ICreditDelegationToken
{
  mapping(address => mapping(address => uint256)) internal _borrowAllowances;

  /**
   * @dev delegates borrowing power to a user on the specific debt token
   * @param delegatee the address receiving the delegated borrowing power
   * @param amount the maximum amount being delegated. Delegation will still
   * respect the liquidation constraints (even if delegated, a delegatee cannot
   * force a delegator HF to go below 1)
   **/
  function approveDelegation(address delegatee, uint256 amount) external override {
    _borrowAllowances[_msgSender()][delegatee] = amount;
    emit BorrowAllowanceDelegated(_msgSender(), delegatee, _underlyingAsset, amount);
  }

  /**
   * @dev returns the borrow allowance of the user
   * @param fromUser The user to giving allowance
   * @param toUser The user to give allowance to
   * @return the current allowance of toUser
   **/
  function borrowAllowance(address fromUser, address toUser)
    external
    view
    override
    returns (uint256)
  {
    return _borrowAllowances[fromUser][toUser];
  }

  /**
   * @dev Being non transferrable, the debt token does not implement any of the
   * standard ERC20 functions for transfer and allowance.
   **/
  function transfer(address, uint256) public override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function allowance(address, address) public view override returns (uint256) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function approve(address, uint256) public override returns (bool) {
    revert('APPROVAL_NOT_SUPPORTED');
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function increaseAllowance(address, uint256) public override returns (bool) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function decreaseAllowance(address, uint256) public override returns (bool) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function _decreaseBorrowAllowance(
    address delegator,
    address delegatee,
    uint256 amount
  ) internal {
    uint256 newAllowance =
      _borrowAllowances[delegator][delegatee].sub(amount, Errors.BORROW_ALLOWANCE_NOT_ENOUGH);

    _borrowAllowances[delegator][delegatee] = newAllowance;

    emit BorrowAllowanceDelegated(delegator, delegatee, _underlyingAsset, newAllowance);
  }

  /**
   * @dev Updates the address of the incentives controller contract
   **/
  function setIncentivesController(address hook) external override onlyRewardAdmin {
    _setIncentivesController(hook);
  }
}
