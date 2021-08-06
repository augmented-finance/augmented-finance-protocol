// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/WadRayMath.sol';

abstract contract CalcBase {
  using SafeMath for uint256;
  using WadRayMath for uint256;
}
