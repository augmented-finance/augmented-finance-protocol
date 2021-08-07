// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../tools/upgradeability/VersionedInitializable.sol';
import '../../tools/Errors.sol';
import '../../interfaces/IDelegationToken.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/DepositTokenBase.sol';

/// @dev Token able delegate voting power of the underlying asset (COMP delegation interface) to a different address.
contract DelegationAwareDepositToken is DepositTokenBase, VersionedInitializable {
  uint256 private constant TOKEN_REVISION = 0x1;

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function initialize(
    PoolTokenConfig calldata config,
    string calldata name,
    string calldata symbol,
    uint8 decimals,
    bytes calldata params
  ) external override initializerRunAlways(TOKEN_REVISION) {
    _initializeERC20(name, symbol, decimals);
    if (!isRevisionInitialized(TOKEN_REVISION)) {
      _initializeDomainSeparator();
    }
    _treasury = config.treasury;
    _initializePoolToken(config, name, symbol, decimals, params);
  }

  modifier onlyPoolAdmin {
    require(_pool.getAccessController().isPoolAdmin(msg.sender), Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  /// @dev Delegates voting power of the underlying asset to a `delegatee` address
  function delegateUnderlyingTo(address delegatee) external onlyPoolAdmin {
    IDelegationToken(_underlyingAsset).delegate(delegatee);
  }
}
