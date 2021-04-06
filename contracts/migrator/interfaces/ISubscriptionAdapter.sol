// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';

interface ISubscriptionAdapter {
  function ORIGIN_ASSET_ADDRESS() external view returns (address);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external returns (uint256);

  function withdrawFromMigrate(uint256 amount) external returns (uint256);

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder) external returns (uint256);

  function balanceForMigrate(address subscriber) external view returns (uint256);
}
