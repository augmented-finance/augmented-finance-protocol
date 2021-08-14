// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../protocol/lendingpool/LendingPoolCompatible.sol';
import '../../access/interfaces/IMarketAccessController.sol';

contract MockLendingPool is LendingPoolCompatible {
  constructor() {
    // enables to use this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }

  function reInitialize(IMarketAccessController provider) public {
    initialize(provider);
  }
}
