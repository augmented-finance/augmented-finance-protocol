// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IDerivedToken} from '../../../interfaces/IDerivedToken.sol';

interface IStakedAave is IDerivedToken {
  function stake(address to, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function cooldown() external;

  function getCooldown(address holder) external returns (uint40);
}
