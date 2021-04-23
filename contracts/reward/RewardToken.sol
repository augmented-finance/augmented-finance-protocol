// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {ERC20WithPermit} from '../misc/ERC20WithPermit.sol';
import {IRewardMinter} from './interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

abstract contract RewardToken is ERC20WithPermit, IRewardMinter {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20WithPermit(name, symbol, decimals) {}
}
