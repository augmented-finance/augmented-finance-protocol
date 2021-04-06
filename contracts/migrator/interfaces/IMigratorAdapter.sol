// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';

interface IMigratorAdapter {
  function ORIGIN_ASSET_ADDRESS() external view returns (address);

  function TARGET_ASSET_ADDRESS() external view returns (address);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
