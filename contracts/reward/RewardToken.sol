// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/tokens/ERC20BaseWithPermit.sol';

abstract contract RewardToken is ERC20BaseWithPermit {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) ERC20BaseWithPermit(name, symbol, decimals) {}
}
