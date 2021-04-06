// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';

struct RewardUpdate {
  uint256 prevAmount;
  uint256 lastAmount;
  uint40 prevTimestamp;
  uint40 lastTimestamp;
}

interface IMigratorRewardController {
  function depositForMigrateIncreased(
    uint256 amount,
    address holder,
    uint256 rayFactor,
    uint64 referralCode
  ) external;

  function depositForMigrateDecreased(
    uint256 amount,
    address holder,
    uint256 rayFactor
  ) external;

  function depositForMigrateRemoved(address holder) external;

  function depositForMigrateRetrived(
    uint256 finalAmount,
    address holder,
    uint256 rayFactor
  ) external;
}

interface IDepositRewardController {
  function depositIncreased(
    uint256 oldAmount,
    uint256 newAmount,
    address holder,
    uint64 referralCode
  ) external;

  function depositDecreased(
    uint256 oldAmount,
    uint256 newAmount,
    address holder
  ) external;
}

interface IRewardDispenser {
  //   function ORIGIN_ASSET_ADDRESS() external view returns (address);
  //   function UNDERLYING_ASSET_ADDRESS() external view returns (address);
  //  function depositIncreased(uint256 oldAmount, uint256 newAmount, address holder, uint64 referralCode) external;
  //  function depositDecreased(uint256 amount, address holder) external returns (uint256);
  //  function depositTotal(address subscriber) external view returns (uint256);
}
