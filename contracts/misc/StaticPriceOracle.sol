// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/ILendingRateOracle.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/AccessFlags.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../interfaces/IPriceOracleGetter.sol';

contract StaticPriceOracle is MarketAccessBitmask, IPriceOracleGetter {
  mapping(address => uint256) private prices;

  constructor(
    IMarketAccessController remoteAcl,
    address[] memory assets_,
    uint256[] memory prices_
  ) MarketAccessBitmask(remoteAcl) {
    require(assets_.length == prices_.length, 'length mismatch');
    for (uint256 i = 0; i < assets_.length; i++) {
      prices[assets_[i]] = prices_[i];
    }
  }

  function getAssetPrice(address asset) public view override returns (uint256) {
    uint256 price = prices[asset];
    require(price != 0, 'unknown asset');
    return price;
  }

  function setAssetPrice(address asset, uint256 price) external aclHas(AccessFlags.ORACLE_ADMIN) {
    prices[asset] = price;
  }

  function setAssetPrices(address[] calldata assets_, uint256[] calldata prices_)
    external
    aclHas(AccessFlags.ORACLE_ADMIN)
  {
    require(assets_.length == prices_.length, 'length mismatch');
    for (uint256 i = 0; i < assets_.length; i++) {
      prices[assets_[i]] = prices_[i];
    }
  }
}
