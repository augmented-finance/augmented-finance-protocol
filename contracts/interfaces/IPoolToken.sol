// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import './IDerivedToken.sol';
import './IRewardedToken.sol';

interface IPoolToken is IDerivedToken, IRewardedToken {
  function POOL() external view returns (address);
}
