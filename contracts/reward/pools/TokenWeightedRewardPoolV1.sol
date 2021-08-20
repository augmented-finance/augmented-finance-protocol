// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IInitializableRewardPool.sol';
import '../interfaces/IRewardController.sol';
import './TokenWeightedRewardPool.sol';

contract TokenWeightedRewardPoolV1 is IInitializableRewardPool, TokenWeightedRewardPool, VersionedInitializable {
  uint256 private constant POOL_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  constructor() TokenWeightedRewardPool(IRewardController(address(0)), 0, 0) {}

  function initializeRewardPool(InitRewardPoolData memory data) public override initializer(POOL_REVISION) {
    super._initialize(data.controller, 0, data.baselinePercentage, data.poolName);
  }

  function initializedRewardPoolWith() external view override returns (InitRewardPoolData memory) {
    return InitRewardPoolData(IRewardController(getRewardController()), getPoolName(), getBaselinePercentage());
  }
}
