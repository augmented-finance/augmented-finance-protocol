// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/DepositTokenBase.sol';

/// @dev Deposit token, an interest bearing token for the Augmented Finance protocol
contract DepositToken is DepositTokenBase, VersionedInitializable {
  uint256 private constant TOKEN_REVISION = 0x1;

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function initialize(
    PoolTokenConfig calldata config,
    string calldata name,
    string calldata symbol,
    bytes calldata params
  ) external override initializerRunAlways(TOKEN_REVISION) {
    require(config.treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    _initializeERC20(name, symbol, config.underlyingDecimals);
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      _initializeDomainSeparator();
      _treasury = config.treasury;
      _initializePoolToken(config, params);
    }
    _emitInitialized(config, params);
  }
}
