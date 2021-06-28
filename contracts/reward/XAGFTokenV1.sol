// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {AccessFlags} from '../access/AccessFlags.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';

import {RewardedTokenLocker} from './locker/RewardedTokenLocker.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';

import 'hardhat/console.sol';

contract XAGFTokenV1 is RewardedTokenLocker, VersionedInitializable {
  string internal constant NAME = 'Augmented Finance Locked Reward Token';
  string internal constant SYMBOL = 'xAGF';
  uint8 internal constant DECIMALS = 18;

  string private _name;
  string private _symbol;
  uint8 private _decimals;

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    public
    RewardedTokenLocker(IMarketAccessController(0), 1 weeks, 4 * 52 weeks, 10**36)
  {
    _initializeERC20(NAME, SYMBOL, DECIMALS);
  }

  function _initializeERC20(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
  }

  function name() public view returns (string memory) {
    return _name;
  }

  function symbol() public view returns (string memory) {
    return _symbol;
  }

  function decimals() public view returns (uint8) {
    return _decimals;
  }

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
    string calldata name_,
    string calldata symbol_
  ) public virtual initializerRunAlways(TOKEN_REVISION) {
    _initialize(remoteAcl, name_, symbol_);
  }

  function _initialize(
    IMarketAccessController remoteAcl,
    string memory name_,
    string memory symbol_
  ) private {
    _initializeERC20(name_, symbol_, DECIMALS);
    _remoteAcl = remoteAcl;
  }
}
