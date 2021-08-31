// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardMinter.sol';
import '../access/AccessFlags.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../tools/tokens/ERC20BaseWithPermit.sol';

abstract contract RewardToken is ERC20BaseWithPermit, MarketAccessBitmask, IRewardMinter {
  function mintReward(
    address account,
    uint256 amount,
    bool
  ) external virtual override aclAnyOf(AccessFlags.REWARD_CONTROLLER) {
    _mint(account, amount);
  }
}
