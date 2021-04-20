// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {AGToken} from '../../protocol/tokenization/AGToken.sol';

contract MockAToken is AGToken {
  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }
}
