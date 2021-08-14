// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IDerivedToken.sol';
import './IRewardedToken.sol';

// solhint-disable func-name-mixedcase
interface IPoolToken is IDerivedToken, IRewardedToken {
  function POOL() external view returns (address);
}
