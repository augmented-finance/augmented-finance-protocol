// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {StableDebtToken} from '../../protocol/tokenization/StableDebtToken.sol';

contract MockStableDebtToken is StableDebtToken {
  constructor() public {
    // enables use of this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }
}
