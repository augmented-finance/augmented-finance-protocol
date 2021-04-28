// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IAccessController} from './IAccessController.sol';

/**
 * @title IMarketAccessController contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 **/
interface IMarketAccessController is IAccessController {
  function getMarketId() external view returns (string memory);

  function getLendingPool() external view returns (address);

  function getLendingPoolConfigurator() external view returns (address);

  function getLendingPoolCollateralManager() external view returns (address);

  function isPoolAdmin(address) external view returns (bool);

  function getPriceOracle() external view returns (address);

  function getLendingRateOracle() external view returns (address);

  function isRewardAdmin(address) external view returns (bool);

  function isSponsoredLoanUser(address) external view returns (bool);

  function getTreasury() external view returns (address);
}

interface IManagedMarketAccessController is IMarketAccessController {
  event MarketIdSet(string newMarketId);

  function setMarketId(string calldata marketId) external;

  function setLendingPoolImpl(address pool) external;

  function setLendingPoolConfiguratorImpl(address configurator) external;

  function setLendingPoolCollateralManager(address manager) external;

  function getPoolAdmin() external view returns (address);

  function setPoolAdmin(address admin) external;

  function setPriceOracle(address priceOracle) external;

  function setLendingRateOracle(address lendingRateOracle) external;

  function setTreasuryImpl(address treasury) external;
}
