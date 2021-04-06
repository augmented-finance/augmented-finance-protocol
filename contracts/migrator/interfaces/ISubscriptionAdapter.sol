// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {ILendableToken} from './ILendableToken.sol';

interface ISubscriptionAdapter {
  function ORIGIN_ASSET_ADDRESS() external view returns (address);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external returns (uint256);

  function withdrawFromMigrate(uint256 amount) external returns (uint256);

  function balanceForMigrate(address subscriber) external view returns (uint256);

  function isClaimable() external view returns (bool);

  function claimMigrated(address holder) external returns (uint256);

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder) external returns (uint256); // onlyOwner

  function admin_setRewardFactor(uint256 rewardFactor) external;

  function admin_migrateAll(ILendableToken targetAsset) external;

  function admin_enableClaims() external;
}
