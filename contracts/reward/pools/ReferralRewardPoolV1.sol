// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IRewardController.sol';
import '../interfaces/IInitializableRewardPool.sol';
import './ReferralRewardPool.sol';

contract ReferralRewardPoolV1 is
  IInitializableRewardPool,
  ReferralRewardPool,
  VersionedInitializable
{
  uint256 private constant POOL_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  constructor() ReferralRewardPool(IRewardController(address(this)), 0, 0, 'RefPool') {}

  function initialize(InitData memory data) public override initializer(POOL_REVISION) {
    super._initialize(data.controller, data.initialRate, data.baselinePercentage, data.poolName);
  }

  function initializedWith() external view override returns (InitData memory) {
    return InitData(_controller, getPoolName(), internalGetRate(), internalGetBaselinePercentage());
  }
}
