// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IManagedMarketAccessController} from './interfaces/IMarketAccessController.sol';
import {AccessController} from './AccessController.sol';
import {AccessFlags} from './AccessFlags.sol';

/**
 * @title MarketAccessController contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 **/
contract MarketAccessController is AccessController, IManagedMarketAccessController {
  string private _marketId;

  constructor(string memory marketId)
    public
    AccessController(AccessFlags.SINGLETONS, AccessFlags.ROLES, AccessFlags.PROXIES)
  {
    _setMarketId(marketId);
  }

  /**
   * @dev Returns the id of the Aave market to which this contracts points to
   * @return The market id
   **/
  function getMarketId() external view override returns (string memory) {
    return _marketId;
  }

  /**
   * @dev Allows to set the market which this AddressesProvider represents
   * @param marketId The market id
   */
  function setMarketId(string memory marketId) external override onlyAdmin {
    _setMarketId(marketId);
    emit MarketIdSet(marketId);
  }

  function _setMarketId(string memory marketId) internal {
    _marketId = marketId;
  }

  /**
   * @dev Returns the address of the LendingPool proxy
   * @return The LendingPool proxy address
   **/
  function getLendingPool() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_POOL);
  }

  /**
   * @dev Returns the address of the LendingPoolConfigurator proxy
   * @return The LendingPoolConfigurator proxy address
   **/
  function getLendingPoolConfigurator() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR);
  }

  /**
   * @dev The functions below are getters/setters of addresses that are outside the context
   * of the protocol hence the upgradable proxy pattern is not used
   **/

  function isPoolAdmin(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.POOL_ADMIN, addr);
  }

  function getPriceOracle() external view override returns (address) {
    return getAddress(AccessFlags.PRICE_ORACLE);
  }

  function getLendingRateOracle() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_RATE_ORACLE);
  }

  function getTreasury() external view override returns (address) {
    return getAddress(AccessFlags.TREASURY);
  }

  function getRewardToken() external view override returns (address) {
    return getAddress(AccessFlags.REWARD_TOKEN);
  }

  function getRewardStakeToken() external view override returns (address) {
    return getAddress(AccessFlags.REWARD_STAKE_TOKEN);
  }

  function getRewardController() external view override returns (address) {
    return getAddress(AccessFlags.REWARD_CONTROLLER);
  }

  function getRewardConfigurator() external view override returns (address) {
    return getAddress(AccessFlags.REWARD_CONFIGURATOR);
  }

  function getStakeConfigurator() external view override returns (address) {
    return getAddress(AccessFlags.STAKE_CONFIGURATOR);
  }
}
