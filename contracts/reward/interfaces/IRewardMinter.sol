// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

interface IRewardMinter {
  function mint(address holder, uint256 amount) external;
}
