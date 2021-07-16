// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {AccessFlags} from '../access/AccessFlags.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';

import {DecayingTokenLocker} from './locker/DecayingTokenLocker.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {IInitializableRewardToken} from './interfaces/IInitializableRewardToken.sol';
import {IRemoteAccessBitmask} from '../access/interfaces/IRemoteAccessBitmask.sol';

import 'hardhat/console.sol';

contract XAGFTokenV1 is IInitializableRewardToken, DecayingTokenLocker, VersionedInitializable {
  string internal constant NAME = 'Augmented Finance Locked Reward Token';
  string internal constant SYMBOL = 'xAGF';
  uint8 internal constant DECIMALS = 18;

  string private _name;
  string private _symbol;
  uint8 private _decimals;

  uint256 private constant TOKEN_REVISION = 1;
  uint32 private constant ONE_PERIOD = 1 weeks;
  uint32 private constant MAX_PERIOD = 4 * 52 weeks;
  uint256 private constant WEIGHT_BASE = 1e36;

  constructor()
    public
    DecayingTokenLocker(IMarketAccessController(0), address(0), ONE_PERIOD, MAX_PERIOD, WEIGHT_BASE)
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
    _initialize(remoteAcl, remoteAcl.getRewardToken(), NAME, SYMBOL, DECIMALS);
  }

  function initialize(InitData calldata data)
    public
    virtual
    override
    initializerRunAlways(TOKEN_REVISION)
  {
    IMarketAccessController ac = IMarketAccessController(address(data.remoteAcl));
    _initialize(ac, ac.getRewardToken(), data.name, data.symbol, data.decimals);
  }

  function initializeToken(
    IMarketAccessController remoteAcl,
    address underlying,
    string calldata name_,
    string calldata symbol_,
    uint8 decimals_
  ) public virtual initializerRunAlways(TOKEN_REVISION) {
    _initialize(remoteAcl, underlying, name_, symbol_, decimals_);
  }

  function _initialize(
    IMarketAccessController remoteAcl,
    address underlying,
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) private {
    require(underlying != address(0), 'underlying is missing');
    _remoteAcl = remoteAcl;
    _initializeERC20(name_, symbol_, decimals_);
    super._initialize(underlying, ONE_PERIOD, MAX_PERIOD);
  }
}
