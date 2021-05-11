// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {AccessFlags} from '../access/AccessFlags.sol';
import {RemoteAccessBitmask} from '../access/RemoteAccessBitmask.sol';
import {
  IRemoteAccessBitmask,
  RemoteAccessBitmaskHelper
} from '../access/interfaces/IRemoteAccessBitmask.sol';

import {IRewardMinter} from '../interfaces/IRewardMinter.sol';
import {RewardToken} from './RewardToken.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {IInitializableRewardToken} from './interfaces/IInitializableRewardToken.sol';

import 'hardhat/console.sol';

contract AGFToken is
  RewardToken,
  RemoteAccessBitmask,
  VersionedInitializable,
  IInitializableRewardToken,
  IRewardMinter
{
  string internal constant NAME = 'Augmented Finance Reward Token';
  string internal constant SYMBOL = 'AGF';
  uint8 internal constant DECIMALS = 18;

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    public
    RewardToken(NAME, SYMBOL, DECIMALS)
    RemoteAccessBitmask(IRemoteAccessBitmask(0))
  {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function initialize(
    IRemoteAccessBitmask remoteAcl,
    string calldata name,
    string calldata symbol
  ) external virtual override initializerRunAlways(TOKEN_REVISION) {
    super._initializeERC20(name, symbol, DECIMALS);
    _remoteAcl = remoteAcl;
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      super._initializeDomainSeparator();
    }
  }

  function mintReward(address account, uint256 amount)
    external
    override
    aclHas(AccessFlags.REWARD_MINT)
    returns (IRewardMinter, address)
  {
    _mint(account, amount);
    return (IRewardMinter(0), address(0));
  }

  function burn(address account, uint256 amount) external aclHas(AccessFlags.REWARD_BURN) {
    _burn(account, amount);
  }

  function _checkTransfer(address from, address to) internal view virtual {
    require(_getRemoteAcl(from) & AccessFlags.REWARD_SUSPEND_USER == 0, 'sender is suspended');
    if (from == to) {
      return;
    }
    require(_getRemoteAcl(to) & AccessFlags.REWARD_SUSPEND_USER == 0, 'receiver is suspended');
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);
    _checkTransfer(from, to);
  }
}
