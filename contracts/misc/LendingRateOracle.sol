// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IManagedLendingRateOracle.sol';
import '../interfaces/ILendingRateOracle.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/AccessFlags.sol';
import '../access/interfaces/IMarketAccessController.sol';

contract LendingRateOracle is ILendingRateOracle, IManagedLendingRateOracle, MarketAccessBitmask {
  mapping(address => uint256) private borrowRates;
  mapping(address => uint256) private liquidityRates;

  constructor(IMarketAccessController remoteAcl) MarketAccessBitmask(remoteAcl) {}

  function getMarketBorrowRate(address _asset) external view override returns (uint256) {
    return borrowRates[_asset];
  }

  function setMarketBorrowRate(address _asset, uint256 _rate) external override aclHas(AccessFlags.LENDING_RATE_ADMIN) {
    borrowRates[_asset] = _rate;
  }

  function setMarketBorrowRates(address[] calldata assets, uint256[] calldata rates)
    external
    override
    aclHas(AccessFlags.LENDING_RATE_ADMIN)
  {
    require(assets.length == rates.length, 'array lengths different');

    for (uint256 i = 0; i < assets.length; i++) {
      borrowRates[assets[i]] = rates[i];
    }
  }

  function getMarketLiquidityRate(address _asset) external view returns (uint256) {
    return liquidityRates[_asset];
  }

  function setMarketLiquidityRate(address _asset, uint256 _rate) external aclHas(AccessFlags.LENDING_RATE_ADMIN) {
    liquidityRates[_asset] = _rate;
  }
}
