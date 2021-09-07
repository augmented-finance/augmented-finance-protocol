// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IDerivedToken.sol';

// solhint-disable func-name-mixedcase
interface IPoolToken is IDerivedToken {
  function POOL() external view returns (address);

  function updatePool() external;
}
