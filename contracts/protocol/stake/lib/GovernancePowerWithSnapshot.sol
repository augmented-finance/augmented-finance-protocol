// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ERC20} from '../../../dependencies/openzeppelin/contracts/ERC20.sol';
import {SafeMath} from '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {ITransferHook} from '../interfaces/ITransferHook.sol';
import {GovernancePowerDelegationERC20} from '../../governance/GovernancePowerDelegationERC20.sol';

/**
 * @title ERC20WithSnapshot
 * @notice ERC20 including snapshots of balances on transfer-related actions
 * @author Aave
 **/
abstract contract GovernancePowerWithSnapshot is GovernancePowerDelegationERC20 {
  using SafeMath for uint256;

  mapping(address => mapping(uint256 => Snapshot)) public _votingSnapshots;
  mapping(address => uint256) public _votingSnapshotsCounts;

  /// @dev reference to the Aave governance contract to call (if initialized) on _beforeTokenTransfer
  /// !!! IMPORTANT The Aave governance is considered a trustable contract, being its responsibility
  /// to control all potential reentrancies by calling back the this contract
  ITransferHook public _governance;

  function _setGovernance(ITransferHook governance) internal virtual {
    _governance = governance;
  }
}
