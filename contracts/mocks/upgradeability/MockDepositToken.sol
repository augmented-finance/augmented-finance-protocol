// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import '../../protocol/tokenization/DepositToken.sol';

contract MockDepositToken is DepositToken {
  constructor() public {
    // enables use of this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }
}
