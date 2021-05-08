// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IMigratorHook {
  function handleTokenMigrated(address token, address[] memory rewardPools) external;
}
