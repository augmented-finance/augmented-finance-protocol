// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/tokens/ERC20DetailsBase.sol';
import './RewardedTokenBase.sol';

abstract contract PoolTokenWithRewardsBase is ERC20DetailsBase, RewardedTokenBase {
  // RewardedTokenBase or IncentivisedTokenBase
}
