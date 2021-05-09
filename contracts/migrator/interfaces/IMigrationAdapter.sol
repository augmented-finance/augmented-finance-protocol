// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {ILendableToken} from './ILendableToken.sol';
import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

interface IMigrationAdapter {
  function ORIGIN_ASSET_ADDRESS() external view returns (address);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function getRewardPool() external view returns (address);

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external returns (uint256);

  function withdrawFromMigrate(uint256 amount) external returns (uint256);

  function balanceForMigrate(address) external view returns (uint256);

  function isClaimable() external view returns (bool);

  function claimMigrated(address) external returns (uint256 amount, bool claimable);

  function claimMigratedPortion(address holder, uint256 divisor)
    external
    returns (uint256 amount, bool claimable);

  function balanceMigrated(address) external view returns (uint256);

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder) external returns (uint256); // onlyOwner

  function getController() external returns (address);

  function admin_setRewardPool(IBalanceHook rewardPool) external;

  function admin_migrateAll(ILendableToken targetAsset) external;

  function admin_enableClaims() external;

  function admin_setPaused(bool paused) external;
}
