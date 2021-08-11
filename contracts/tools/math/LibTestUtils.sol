// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './InterestMath.sol';

import 'hardhat/console.sol';

contract LibTestUtils {
  function TestLinearInterest(uint256 rate, uint256 ts) public view returns (uint256) {
    // console.log('block ts:', ts);
    uint256 res = InterestMath.calculateLinearInterest(rate, uint40(ts));
    return res;
  }
}
