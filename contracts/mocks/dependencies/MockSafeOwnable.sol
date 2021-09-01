// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '../../tools/SafeOwnable.sol';

contract MockSafeOwnable is SafeOwnable {
  function testAccess() external view onlyOwner {}
}
