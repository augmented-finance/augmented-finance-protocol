// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {ILendableToken} from './ILendableToken.sol';
import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';
import {IEmergencyAccess} from '../../interfaces/IEmergencyAccess.sol';

interface IMigrationAdapter is IEmergencyAccess {
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

  function preDepositOnBehalf() external returns (uint256); // onlyOwner

  function postDepositOnBehalf(
    address holder,
    uint256 preBalance,
    uint256 amount,
    uint64 referralCode
  ) external returns (uint256); // onlyOwner

  function getController() external returns (address);

  function setRewardPool(IBalanceHook rewardPool) external;

  function migrateAll(ILendableToken targetAsset) external;

  function enableClaims() external;

  function sweepToken(address token, address to) external returns (uint256);

  event DepositedForMigrate(
    address indexed token,
    address indexed holder,
    uint256 amount,
    uint256 internalBalance,
    uint64 indexed referralCode
  );
  event WithdrawnFromMigrate(
    address indexed token,
    address indexed holder,
    uint256 amount,
    uint256 internalBalance
  );
}
