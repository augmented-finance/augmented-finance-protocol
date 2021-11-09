// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../reward/AGFTokenV2.sol';

contract MockAgfToken is AGFTokenV2 {
  constructor() {
    // enables use of this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }

  modifier onlyRewardControllder() override {
    _;
  }
}
