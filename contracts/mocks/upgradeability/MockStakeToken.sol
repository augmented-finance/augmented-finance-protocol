// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../protocol/stake/StakeToken.sol';

contract MockStakeToken is StakeToken {
  constructor() {
    // enables use of this instance without a proxy
    // _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }
}
