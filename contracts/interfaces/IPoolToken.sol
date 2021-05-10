// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IDerivedToken} from './IDerivedToken.sol';
import {ILendingPool} from './ILendingPool.sol';

interface IPoolToken is IDerivedToken {
  function setIncentivesController(address) external;

  function POOL() external view returns (ILendingPool);
}
