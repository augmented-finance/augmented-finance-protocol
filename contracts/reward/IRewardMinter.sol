// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IRewardMinter {
  function mint(address holder, uint256 amount) external;
}
