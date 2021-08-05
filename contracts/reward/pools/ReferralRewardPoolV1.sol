// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/BitUtils.sol';
import '../interfaces/IRewardController.sol';
import './ReferralRewardPool.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IInitializableRewardPool.sol';

contract ReferralRewardPoolV1 is
  IInitializableRewardPool,
  ReferralRewardPool,
  VersionedInitializable
{
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private constant POOL_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  constructor() public ReferralRewardPool(IRewardController(address(this)), 0, 0, 'RefPool') {}

  function initialize(InitData memory data) public override initializer(POOL_REVISION) {
    super._initialize(data.controller, data.initialRate, data.baselinePercentage, data.poolName);
  }

  function initializedWith() external view override returns (InitData memory) {
    return InitData(_controller, getPoolName(), internalGetRate(), internalGetBaselinePercentage());
  }
}
