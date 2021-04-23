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

  constructor(string memory marketId) public {
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
  function setMarketId(string memory marketId) external override onlyOwner {
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
   * @dev Updates the implementation of the LendingPool, or creates the proxy
   * setting the new `pool` implementation on the first time calling it
   * @param pool The new LendingPool implementation
   **/
  function setLendingPoolImpl(address pool) external override onlyOwner {
    setAddressAsProxy(AccessFlags.LENDING_POOL, pool);
  }

  /**
   * @dev Returns the address of the LendingPoolConfigurator proxy
   * @return The LendingPoolConfigurator proxy address
   **/
  function getLendingPoolConfigurator() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR);
  }

  /**
   * @dev Updates the implementation of the LendingPoolConfigurator, or creates the proxy
   * setting the new `configurator` implementation on the first time calling it
   * @param configurator The new LendingPoolConfigurator implementation
   **/
  function setLendingPoolConfiguratorImpl(address configurator) external override onlyOwner {
    setAddressAsProxy(AccessFlags.LENDING_POOL_CONFIGURATOR, configurator);
  }

  /**
   * @dev Returns the address of the LendingPoolCollateralManager. Since the manager is used
   * through delegateCall within the LendingPool contract, the proxy contract pattern does not work properly hence
   * the addresses are changed directly
   * @return The address of the LendingPoolCollateralManager
   **/

  function getLendingPoolCollateralManager() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_POOL_COLLATERAL_MANAGER);
  }

  /**
   * @dev Updates the address of the LendingPoolCollateralManager
   * @param manager The new LendingPoolCollateralManager address
   **/
  function setLendingPoolCollateralManager(address manager) external override onlyOwner {
    setAddress(AccessFlags.LENDING_POOL_COLLATERAL_MANAGER, manager);
  }

  /**
   * @dev The functions below are getters/setters of addresses that are outside the context
   * of the protocol hence the upgradable proxy pattern is not used
   **/

  function getPoolAdmin() external view override returns (address) {
    return getAddress(AccessFlags.POOL_ADMIN);
  }

  function isPoolAdmin(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.POOL_ADMIN, addr);
  }

  function isRewardAdmin(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.POOL_ADMIN, addr);
  }

  function setPoolAdmin(address admin) external override onlyOwner {
    setAddress(AccessFlags.POOL_ADMIN, admin);
  }

  function getPriceOracle() external view override returns (address) {
    return getAddress(AccessFlags.PRICE_ORACLE);
  }

  function setPriceOracle(address priceOracle) external override onlyOwner {
    setAddress(AccessFlags.PRICE_ORACLE, priceOracle);
  }

  function getLendingRateOracle() external view override returns (address) {
    return getAddress(AccessFlags.LENDING_RATE_ORACLE);
  }

  function setLendingRateOracle(address lendingRateOracle) external override onlyOwner {
    setAddress(AccessFlags.LENDING_RATE_ORACLE, lendingRateOracle);
  }

  function isSponsoredLoanUser(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.POOL_SPONSORED_LOAN_USER, addr);
  }
}
