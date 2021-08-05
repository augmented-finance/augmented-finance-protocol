// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../access/AccessFlags.sol';
import '../access/interfaces/IMarketAccessController.sol';

import {DecayingTokenLocker} from './locker/DecayingTokenLocker.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import {IInitializableRewardToken} from './interfaces/IInitializableRewardToken.sol';
import '../access/interfaces/IRemoteAccessBitmask.sol';
import './interfaces/IRewardController.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';

import 'hardhat/console.sol';

contract XAGFTokenV1 is IInitializableRewardToken, DecayingTokenLocker, VersionedInitializable {
  string internal constant NAME = 'Augmented Finance Locked Reward Token';
  string internal constant SYMBOL = 'xAGF';
  uint8 internal constant DECIMALS = 18;

  string private _name;
  string private _symbol;
  uint8 private _decimals;

  uint256 private constant TOKEN_REVISION = 1;

  constructor() public DecayingTokenLocker(IRewardController(address(this)), 0, 0, address(0)) {
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

  function getPoolName() public view override returns (string memory) {
    return _symbol;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController ac) external virtual initializer(TOKEN_REVISION) {
    address controller = ac.getRewardController();
    address underlying = ac.getRewardToken();

    _initializeERC20(NAME, SYMBOL, DECIMALS);
    super._initialize(underlying);
    super._initialize(IRewardController(controller), 0, 0);
  }

  function initialize(InitData calldata data) public virtual override initializer(TOKEN_REVISION) {
    IMarketAccessController ac = IMarketAccessController(address(data.remoteAcl));
    address controller = ac.getRewardController();
    address underlying = ac.getRewardToken();

    _initializeERC20(data.name, data.symbol, data.decimals);
    super._initialize(underlying);
    super._initialize(IRewardController(controller), 0, 0);
  }

  function initializeToken(
    IMarketAccessController remoteAcl,
    address underlying,
    string calldata name_,
    string calldata symbol_,
    uint8 decimals_
  ) public virtual initializer(TOKEN_REVISION) {
    address controller = remoteAcl.getRewardController();

    _initializeERC20(name_, symbol_, decimals_);
    super._initialize(underlying);
    super._initialize(IRewardController(controller), 0, 0);
  }

  function initializePool(
    IRewardController controller,
    address underlying,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public virtual initializer(TOKEN_REVISION) {
    _initializeERC20(NAME, SYMBOL, DECIMALS);
    super._initialize(underlying);
    super._initialize(controller, initialRate, baselinePercentage);
  }
}
