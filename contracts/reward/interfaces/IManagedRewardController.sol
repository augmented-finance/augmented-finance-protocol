// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IRewardMinter.sol';
import '../../interfaces/IEmergencyAccess.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import './IManagedRewardPool.sol';
import './IRewardController.sol';

interface IManagedRewardController is IEmergencyAccess, IRewardController {
  function updateBaseline(uint256 baseline) external returns (uint256 totalRate);

  function addRewardPool(IManagedRewardPool) external;

  function removeRewardPool(IManagedRewardPool) external;

  function setRewardMinter(IRewardMinter) external;

  function getPools() external view returns (IManagedRewardPool[] memory, uint256 ignoreMask);

  event RewardsAllocated(address indexed user, uint256 amount, address indexed fromPool);
  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

  event BaselineUpdated(uint256 baseline, uint256 totalRate, uint256 mask);
  event RewardPoolAdded(address indexed pool, uint256 mask);
  event RewardPoolRemoved(address indexed pool, uint256 mask);
  event RewardMinterSet(address minter);
}

interface IManagedRewardBooster is IManagedRewardController {
  event BoostFactorSet(address indexed pool, uint256 mask, uint32 pctFactor);

  function setBoostFactor(address pool, uint32 pctFactor) external;

  event MinBoostUpdated(uint16 minBoostPct);

  function setMinBoost(uint16 minBoostPct) external;

  function setUpdateBoostPoolRate(bool) external;

  function setBoostPool(address) external;

  function getBoostPool() external view returns (address pool, uint256 mask);

  function setBoostExcessTarget(address target, bool mintExcess) external;
}

interface IUntypedRewardControllerPools {
  function getPools() external view returns (address[] memory, uint256 ignoreMask);
}
