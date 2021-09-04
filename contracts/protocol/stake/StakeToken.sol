// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './SlashableStakeTokenBase.sol';
import './interfaces/StakeTokenConfig.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';

contract StakeToken is SlashableStakeTokenBase, VersionedInitializable {
  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    ERC20BaseWithPermit('', '', 0)
    SlashableBase(0)
    MarketAccessBitmaskMin(IMarketAccessController(address(0)))
  {}

  function initializeStakeToken(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol
  ) external virtual override initializer(TOKEN_REVISION) {
    super._initializeERC20(name, symbol, params.stakedTokenDecimals);
    super._initializeToken(params);
    super._initializeDomainSeparator();
    emit Initialized(params, name, symbol);
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }
}
