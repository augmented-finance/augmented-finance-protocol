// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {
  DelegationAwareDepositToken
} from '../../protocol/tokenization/DelegationAwareDepositToken.sol';

contract MockDelegationAwareDepositToken is DelegationAwareDepositToken {
  constructor() public {
    // enables use of this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }
}
