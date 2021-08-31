// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './InterestMath.sol';
import './BitUtils.sol';

import 'hardhat/console.sol';

contract LibTestUtils {
  function testLinearInterest(uint256 rate, uint256 ts) external view returns (uint256) {
    return InterestMath.calculateLinearInterest(rate, uint40(ts));
  }

  function testBitLengthShift(uint16 n) external pure returns (uint256) {
    return BitUtils.bitLength(uint256(1) << n);
  }

  function testBitLength(uint256 n) external pure returns (uint256) {
    return BitUtils.bitLength(n);
  }
}
