// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../access/interfaces/IMarketAccessController.sol';
import './RewardBooster.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import '../interfaces/IRewardMinter.sol';

contract RewardBoosterV1 is RewardBooster, VersionedInitializable {
  uint256 private constant CONTRACT_REVISION = 1;

  constructor() public RewardBooster(IMarketAccessController(0), IRewardMinter(0)) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return CONTRACT_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController ac) external virtual initializer(CONTRACT_REVISION) {
    address underlying = ac.getRewardToken();
    require(underlying != address(0));
    _initialize(ac, IRewardMinter(underlying));
  }
}
