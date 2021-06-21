// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {IManagedRewardPool} from './IManagedRewardPool.sol';
import {IRewardMinter} from '../../interfaces/IRewardMinter.sol';
import {IEmergencyAccess} from '../../interfaces/IEmergencyAccess.sol';

interface IRewardCollector {
  function claimReward() external returns (uint256 amount);

  function claimRewardTo(address receiver) external returns (uint256 amount);

  function balanceOf(address holder) external view returns (uint256);

  function totalSupply() external view returns (uint256);
}