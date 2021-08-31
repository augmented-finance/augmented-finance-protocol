// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/DepositTokenBase.sol';

/// @dev Deposit token, an interest bearing token for the Augmented Finance protocol
contract DepositToken is DepositTokenBase, VersionedInitializable {
  uint256 private constant TOKEN_REVISION = 0x1;

  constructor() PoolTokenBase(address(0), address(0)) DepositTokenBase(address(0)) ERC20DetailsBase('', '', 0) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function initialize(
    PoolTokenConfig calldata config,
    string calldata name,
    string calldata symbol,
    bytes calldata params
  ) external override initializerRunAlways(TOKEN_REVISION) {
    if (isRevisionInitialized(TOKEN_REVISION)) {
      _initializeERC20(name, symbol, super.decimals());
    } else {
      _initializeERC20(name, symbol, config.underlyingDecimals);
      _initializePoolToken(config, params);
    }

    emit Initialized(
      config.underlyingAsset,
      address(config.pool),
      address(config.treasury),
      super.name(),
      super.symbol(),
      super.decimals(),
      params
    );
  }
}
