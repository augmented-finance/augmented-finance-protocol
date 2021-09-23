// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/Address.sol';
import '../dependencies/openzeppelin/contracts/IERC20.sol';
import '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../access/AccessFlags.sol';
import '../reward/interfaces/IRewardCollector.sol';

contract Treasury is VersionedInitializable, MarketAccessBitmask {
  using SafeERC20 for IERC20;
  uint256 private constant TREASURY_REVISION = 1;

  address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  constructor() MarketAccessBitmask(IMarketAccessController(address(0))) {}

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address remoteAcl) external virtual initializer(TREASURY_REVISION) {
    _remoteAcl = IMarketAccessController(remoteAcl);
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return TREASURY_REVISION;
  }

  function approveToken(
    address token,
    address recipient,
    uint256 amount
  ) external aclHas(AccessFlags.TREASURY_ADMIN) {
    IERC20(token).safeApprove(recipient, amount);
  }

  function transferToken(
    address token,
    address recipient,
    uint256 amount
  ) external aclHas(AccessFlags.TREASURY_ADMIN) {
    if (token == ETH) {
      Address.sendValue(payable(recipient), amount);
      return;
    }

    if (token == _remoteAcl.getAddress(AccessFlags.REWARD_TOKEN) && IERC20(token).balanceOf(address(this)) < amount) {
      _claimRewards();
    }
    IERC20(token).safeTransfer(recipient, amount);
  }

  function _claimRewards() private {
    address rc = _remoteAcl.getAddress(AccessFlags.REWARD_CONTROLLER);
    if (rc != address(0)) {
      IRewardCollector(rc).claimReward();
    }
  }

  function claimRewardsForTreasury() external aclHas(AccessFlags.TREASURY_ADMIN) {
    _claimRewards();
  }
}
