// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {StakedAgfV1} from '../../protocol/stake/StakedAgfV1.sol';

contract MockStakedAgfToken is StakedAgfV1 {
  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }
}
