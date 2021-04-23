// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {AGFToken} from '../../reward/AGFToken.sol';

contract MockAgfToken is AGFToken {
  function getRevision() internal pure override returns (uint256) {
    return super.getRevision() + 1;
  }

  modifier aclHas(uint256) override {
    _;
  }

  function _checkTransfer(address, address) internal view override {}
}
