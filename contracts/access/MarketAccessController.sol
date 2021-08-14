// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './interfaces/IManagedMarketAccessController.sol';
import './AccessController.sol';
import './AccessFlags.sol';

/// @dev Main registry of addresses part of or connected to the protocol, including permissioned roles. Also acts a proxy factory.
contract MarketAccessController is AccessController, IManagedMarketAccessController {
  string private _marketId;

  constructor(string memory marketId) AccessController(AccessFlags.SINGLETONS, AccessFlags.ROLES, AccessFlags.PROXIES) {
    _marketId = marketId;
  }

  function getMarketId() external view override returns (string memory) {
    return _marketId;
  }

  function setMarketId(string memory marketId) external override onlyAdmin {
    _marketId = marketId;
    emit MarketIdSet(marketId);
  }

  function getLendingPool() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_POOL);
  }

  function getPriceOracle() external view override returns (address) {
    return getAddress(AccessFlags.PRICE_ORACLE);
  }

  function getLendingRateOracle() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_RATE_ORACLE);
  }
}
