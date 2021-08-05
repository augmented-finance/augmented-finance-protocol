// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/BitUtils.sol';
import '../interfaces/IRewardController.sol';
import './TokenWeightedRewardPool.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IInitializableRewardPool.sol';

contract TokenWeightedRewardPoolV1 is
  IInitializableRewardPool,
  TokenWeightedRewardPool,
  VersionedInitializable
{
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private constant POOL_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return POOL_REVISION;
  }

  constructor() public TokenWeightedRewardPool(IRewardController(address(this)), 0, 0) {}

  function initialize(InitData memory data) public override initializer(POOL_REVISION) {
    super._initialize(data.controller, data.initialRate, data.baselinePercentage);
  }

  function initializedWith() external view override returns (InitData memory) {
    return InitData(_controller, getPoolName(), internalGetRate(), internalGetBaselinePercentage());
  }
}
