// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

interface IRedeemableToken is IERC20 {
  function redeem(uint256 amount) external returns (uint256);
}
