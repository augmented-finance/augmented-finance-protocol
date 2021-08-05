// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IDelegationToken.sol';
import '../../tools/Errors.sol';
import './DepositToken.sol';

/// @dev Token able delegate voting power of the underlying asset (COMP delegation interface) to a different address.
contract DelegationAwareDepositToken is DepositToken {
  modifier onlyPoolAdmin {
    require(
      ILendingPool(_pool).getAccessController().isPoolAdmin(msg.sender),
      Errors.CALLER_NOT_POOL_ADMIN
    );
    _;
  }

  /// @dev Delegates voting power of the underlying asset to a `delegatee` address
  function delegateUnderlyingTo(address delegatee) external onlyPoolAdmin {
    IDelegationToken(_underlyingAsset).delegate(delegatee);
  }
}
