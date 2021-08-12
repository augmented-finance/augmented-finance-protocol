// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/AccessFlags.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';

import '../interfaces/IRewardMinter.sol';
import './RewardToken.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/IInitializableRewardToken.sol';

contract AGFTokenV1 is
  RewardToken,
  MarketAccessBitmask,
  VersionedInitializable,
  IInitializableRewardToken,
  IRewardMinter
{
  string internal constant NAME = 'Augmented Finance Reward Token';
  string internal constant SYMBOL = 'AGF';
  uint8 internal constant DECIMALS = 18;

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    RewardToken(NAME, SYMBOL, DECIMALS)
    MarketAccessBitmask(IMarketAccessController(address(0)))
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
    _initialize(remoteAcl, NAME, SYMBOL, DECIMALS);
  }

  function initialize(InitData calldata data)
    public
    virtual
    override
    initializerRunAlways(TOKEN_REVISION)
  {
    _initialize(data.remoteAcl, data.name, data.symbol, data.decimals);
  }

  function _initialize(
    IMarketAccessController remoteAcl,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) private {
    super._initializeERC20(name, symbol, decimals);
    _remoteAcl = remoteAcl;
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      super._initializeDomainSeparator();
    }
  }

  function mintReward(
    address account,
    uint256 amount,
    bool
  ) external virtual override aclAnyOf(AccessFlags.REWARD_CONTROLLER) {
    _mint(account, amount);
  }
}
