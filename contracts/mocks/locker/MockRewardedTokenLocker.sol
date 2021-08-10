// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import '../../reward/locker/RewardedTokenLocker.sol';
import '../../reward/interfaces/IRewardController.sol';

import 'hardhat/console.sol';

contract MockRewardedTokenLocker is RewardedTokenLocker {
  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address underlying
  ) RewardedTokenLocker(controller, initialRate, baselinePercentage, underlying) {}

  function isController(address addr) internal pure override returns (bool) {
    return addr != address(0);
  }
}
