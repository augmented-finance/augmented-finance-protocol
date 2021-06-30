// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IEmergencyAccess} from '../../interfaces/IEmergencyAccess.sol';

interface IManagedRewardPool is IEmergencyAccess {
  function updateBaseline(uint256) external returns (bool hasBaseline, uint256 appliedRate);

  function setBaselinePercentage(uint16) external;

  function disableBaseline() external;

  function disableRewardPool() external;

  function setRate(uint256) external;

  function setRateScale(uint256) external;

  function claimRewardFor(address holder) external returns (uint256 amount, uint32 since);

  function calcRewardFor(address holder) external view returns (uint256 amount, uint32 since);

  function addRewardProvider(address provider, address token) external;

  function removeRewardProvider(address provider) external;

  function getRewardController() external view returns (address);
}
