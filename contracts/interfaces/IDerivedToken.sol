// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

interface IDerivedToken {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
