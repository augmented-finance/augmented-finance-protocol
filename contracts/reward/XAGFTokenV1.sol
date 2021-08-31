// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/AccessFlags.sol';
import '../access/interfaces/IMarketAccessController.sol';

import './locker/DecayingTokenLocker.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/IInitializableRewardToken.sol';
import './interfaces/IInitializableRewardPool.sol';
import '../access/interfaces/IRemoteAccessBitmask.sol';
import './interfaces/IRewardController.sol';
import '../tools/math/WadRayMath.sol';
import '../tools/tokens/ERC20DetailsBase.sol';

contract XAGFTokenV1 is
  DecayingTokenLocker,
  VersionedInitializable,
  ERC20DetailsBase,
  IInitializableRewardToken,
  IInitializableRewardPool
{
  string private constant NAME = 'Augmented Finance Locked Reward Token';
  string private constant SYMBOL = 'xAGF';
  uint8 private constant DECIMALS = 18;

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    ERC20DetailsBase(NAME, SYMBOL, DECIMALS)
    DecayingTokenLocker(IRewardController(address(this)), 0, 0, address(0))
  {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function getPoolName() public view override returns (string memory) {
    return super.symbol();
  }

  function _initializePool(address controller) private {
    super._initialize(IRewardController(controller), 0, 0, '');
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController ac) external virtual initializer(TOKEN_REVISION) {
    address controller = ac.getAddress(AccessFlags.REWARD_CONTROLLER);
    address underlying = ac.getAddress(AccessFlags.REWARD_TOKEN);

    super._initializeERC20(NAME, SYMBOL, DECIMALS);
    super._initialize(underlying);
    _initializePool(controller);
  }

  function initializeRewardToken(InitRewardTokenData calldata data) external override initializer(TOKEN_REVISION) {
    IMarketAccessController ac = IMarketAccessController(address(data.remoteAcl));
    address controller = ac.getAddress(AccessFlags.REWARD_CONTROLLER);
    address underlying = ac.getAddress(AccessFlags.REWARD_TOKEN);

    super._initializeERC20(data.name, data.symbol, data.decimals);
    super._initialize(underlying);
    _initializePool(controller);
  }

  function initializeToken(
    IMarketAccessController remoteAcl,
    address underlying,
    string calldata name_,
    string calldata symbol_,
    uint8 decimals_
  ) public virtual initializer(TOKEN_REVISION) {
    address controller = remoteAcl.getAddress(AccessFlags.REWARD_CONTROLLER);

    super._initializeERC20(name_, symbol_, decimals_);
    super._initialize(underlying);
    _initializePool(controller);
  }

  function initializeRewardPool(InitRewardPoolData calldata data) external override initializer(TOKEN_REVISION) {
    IMarketAccessController ac = data.controller.getAccessController();
    address underlying = ac.getAddress(AccessFlags.REWARD_TOKEN);
    super._initializeERC20(NAME, SYMBOL, DECIMALS);
    super._initialize(underlying);
    super._initialize(data.controller, 0, data.baselinePercentage, data.poolName);
  }

  function initializedRewardPoolWith() external view override returns (InitRewardPoolData memory) {
    return
      InitRewardPoolData(
        IRewardController(super.getRewardController()),
        super.getPoolName(),
        super.getBaselinePercentage()
      );
  }
}
