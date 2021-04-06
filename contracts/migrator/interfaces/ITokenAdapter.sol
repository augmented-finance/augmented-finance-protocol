// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';

interface ITokenAdapter {
  function ORIGIN_ASSET_ADDRESS() external returns (address);

  function UNDERLYING_ASSET_ADDRESS() external returns (address);
}
