// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IRemoteAccessBitmask} from '../access/interfaces/IRemoteAccessBitmask.sol';

import {RewardToken} from './RewardToken.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {IInitializableRewardToken} from './interfaces/IInitializableRewardToken.sol';

import 'hardhat/console.sol';

contract AGFToken is RewardToken, VersionedInitializable, IInitializableRewardToken {
  string internal constant NAME = 'Augmented Finance Reward Token';
  string internal constant SYMBOL = 'AGF';
  uint8 internal constant DECIMALS = 18;

  uint256 private constant TOKEN_REVISION = 1;

  constructor() public RewardToken(IRemoteAccessBitmask(0), NAME, SYMBOL, DECIMALS) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function initialize(
    IRemoteAccessBitmask remoteAcl,
    string calldata name,
    string calldata symbol
  ) external virtual override initializerRunAlways(TOKEN_REVISION) {
    super._initializeERC20(name, symbol, DECIMALS);
    super._initializeToken(remoteAcl);
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      super._initializeDomainSeparator();
    }
  }
}
