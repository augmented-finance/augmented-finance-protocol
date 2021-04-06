// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';

interface ILendableToken is IERC20 {
  function POOL() external returns (ILendingPool);
}
