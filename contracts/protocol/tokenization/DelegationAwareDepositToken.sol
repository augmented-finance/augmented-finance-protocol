// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IDelegationToken.sol';
import './DepositToken.sol';

/// @dev Token able delegate voting power of the underlying asset (COMP delegation interface) to a different address.
contract DelegationAwareDepositToken is DepositToken {
  /// @dev Delegates voting power of the underlying asset to a `delegatee` address
  function delegateUnderlyingTo(address delegatee) external onlyLendingPoolAdmin {
    IDelegationToken(_underlyingAsset).delegate(delegatee);
  }
}
