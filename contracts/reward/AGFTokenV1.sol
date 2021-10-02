// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './RewardToken.sol';
import '../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/IInitializableRewardToken.sol';

contract AGFTokenV1 is RewardToken, VersionedInitializable, IInitializableRewardToken {
  string private constant NAME = 'Augmented Finance Reward Token';
  string private constant SYMBOL = 'AGF';

  uint256 private constant TOKEN_REVISION = 1;
  uint256 private constant TREASURY_MINT = 1000;

  constructor() ERC20BaseWithPermit(NAME, SYMBOL, DECIMALS) MarketAccessBitmask(IMarketAccessController(address(0))) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController remoteAcl) external virtual initializer(TOKEN_REVISION) {
    _initialize(remoteAcl, NAME, SYMBOL, DECIMALS);
  }

  function initializeRewardToken(InitRewardTokenData calldata data)
    external
    virtual
    override
    initializer(TOKEN_REVISION)
  {
    _initialize(data.remoteAcl, data.name, data.symbol, data.decimals);
  }

  function _initialize(
    IMarketAccessController remoteAcl,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) private {
    require(decimals == DECIMALS, 'UNSUPPORTED_DECIMALS');
    _remoteAcl = remoteAcl;
    super._initializeERC20(name, symbol, decimals);
    super._initializeDomainSeparator();

    if (address(remoteAcl) != address(0)) {
      address treasury = remoteAcl.getAddress(AccessFlags.TREASURY);
      if (treasury != address(0)) {
        _allocateAndMint(treasury, TREASURY_MINT * (10**DECIMALS));
      }
    }
  }
}
