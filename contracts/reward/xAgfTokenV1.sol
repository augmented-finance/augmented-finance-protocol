// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {AccessFlags} from '../access/AccessFlags.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';

import {RewardedTokenLocker} from './locker/RewardedTokenLocker.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';

import 'hardhat/console.sol';

contract xAgfTokenV1 is RewardedTokenLocker, VersionedInitializable {
  string internal constant NAME = 'Augmented Finance Locked Reward Token';
  string internal constant SYMBOL = 'xAGF';
  uint8 internal constant DECIMALS = 18;

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    public
    RewardedTokenLocker(IMarketAccessController(0), 1 weeks, 4 * 52 weeks, 10**36)
  {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController remoteAcl)
    external
    virtual
    initializerRunAlways(TOKEN_REVISION)
  {
    _initialize(remoteAcl, NAME, SYMBOL);
  }

  function initialize(
    IMarketAccessController remoteAcl,
    string calldata name,
    string calldata symbol
  ) public virtual initializerRunAlways(TOKEN_REVISION) {
    _initialize(remoteAcl, name, symbol);
  }

  function _initialize(
    IMarketAccessController remoteAcl,
    string memory name,
    string memory symbol
  ) private {
    name;
    symbol;
    // super._initializeERC20(name, symbol, DECIMALS);
    _remoteAcl = remoteAcl;
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      // super._initializeDomainSeparator();
    }
  }
}
