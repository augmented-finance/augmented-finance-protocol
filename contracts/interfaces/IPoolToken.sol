// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IScaledBalanceToken} from './IScaledBalanceToken.sol';
import {IDerivedToken} from './IDerivedToken.sol';
import {ILendingPool} from './ILendingPool.sol';

interface IPoolToken is IDerivedToken {
  function setIncentivesController(address) external;

  function POOL() external view returns (ILendingPool);
}
