// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../../interfaces/ICreditDelegationToken.sol';
import '../../../tools/Errors.sol';
import './PoolTokenBase.sol';
import '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../../dependencies/openzeppelin/contracts/ERC20Events.sol';

/// @dev Base contract for a non-transferrable debt tokens: StableDebtToken and VariableDebtToken
abstract contract DebtTokenBase is PoolTokenBase('', '', 0), ERC20Events, ICreditDelegationToken {
  using SafeMath for uint256;

  mapping(address => mapping(address => uint256)) internal _borrowAllowances;

  function approveDelegation(address delegatee, uint256 amount) external override {
    _borrowAllowances[msg.sender][delegatee] = amount;
    emit BorrowAllowanceDelegated(msg.sender, delegatee, _underlyingAsset, amount);
  }

  function borrowAllowance(address fromUser, address toUser)
    external
    view
    override
    returns (uint256)
  {
    return _borrowAllowances[fromUser][toUser];
  }

  function transfer(address, uint256) public override returns (bool) {
    notSupported();
    _mutable();
  }

  function allowance(address, address) public view override returns (uint256) {
    this;
    return 0;
  }

  function approve(address, uint256) public override returns (bool) {
    notSupported();
    _mutable();
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public override returns (bool) {
    notSupported();
    _mutable();
  }

  function notSupported() private pure {
    revert('NOT_SUPPORTED');
  }

  function _mutable() private {}

  function increaseAllowance(address, uint256) public override returns (bool) {
    notSupported();
  }

  function decreaseAllowance(address, uint256) public override returns (bool) {
    notSupported();
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
}
