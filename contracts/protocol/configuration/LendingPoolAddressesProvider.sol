// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {MarketAccessController} from '../../access/MarketAccessController.sol';

/**
 * @title LendingPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 **/
contract LendingPoolAddressesProvider is MarketAccessController {
  string private _foo;

  function getFoo() external view returns (string memory) {
    return _foo;
  }

  constructor(string memory marketId) public MarketAccessController(marketId) {}
}
