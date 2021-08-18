// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IRewardController.sol';
import '../interfaces/IInitializableRewardPool.sol';
import './ReferralRewardPool.sol';

contract ReferralRewardPoolV1 is IInitializableRewardPool, ReferralRewardPool, VersionedInitializable {
  uint256 private constant POOL_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  constructor() ReferralRewardPool(IRewardController(address(0)), 0, 0, 'RefPool') {}

  function initializeRewardPool(InitData memory data) public override initializer(POOL_REVISION) {
    super._initialize(data.controller, internalGetRate(), data.baselinePercentage, data.poolName);
    internalSetClaimLimit(type(uint256).max);
  }

  function initializedRewardPoolWith() external view override returns (InitData memory) {
    return InitData(IRewardController(getRewardController()), getPoolName(), internalGetBaselinePercentage());
  }
}
