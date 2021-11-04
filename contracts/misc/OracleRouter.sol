// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/IERC20.sol';

import '../interfaces/IPriceOracle.sol';
import '../interfaces/IPriceFeed.sol';
import '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../access/AccessFlags.sol';

/// @title OracleRouter
/// @notice Proxy smart contract to get the price of an asset from a price source, with Chainlink Aggregator
///         smart contracts as primary option
/// - If the returned price by a Chainlink aggregator is <= 0, the call is forwarded to a fallbackOracle
/// - Owned by the governance system, allowed to add sources for assets, replace them
///   and change the fallbackOracle
contract OracleRouter is IPriceOracle, MarketAccessBitmask {
  using SafeERC20 for IERC20;

  event QuoteSet(address indexed quote);
  event AssetSourceUpdated(address indexed asset, address indexed source);
  event FallbackOracleUpdated(address indexed fallbackOracle);

  mapping(address => IPriceFeed) private _assetsSources;
  IPriceOracleGetter private _fallbackOracle;
  // solhint-disable-next-line var-name-mixedcase
  address private immutable _quote;
  uint256 private immutable _quoteValue;

  constructor(
    IMarketAccessController acl,
    address[] memory assets,
    address[] memory sources,
    address fallbackOracle,
    address quoteToken,
    uint256 quoteValue
  ) MarketAccessBitmask(acl) {
    _quote = quoteToken;
    _quoteValue = quoteValue;
    emit QuoteSet(quoteToken);

    _setFallbackOracle(fallbackOracle);
    _setAssetSources(assets, sources);
  }

  function getQuote() public view returns (address) {
    return _quote;
  }

  function getQuoteAndValue() public view returns (address, uint256) {
    return (_quote, getAssetPrice(_quote));
  }

  /// @param assets The addresses of the assets
  /// @param sources The address of the source of each asset
  function setAssetSources(address[] calldata assets, address[] calldata sources)
    external
    aclHas(AccessFlags.ORACLE_ADMIN)
  {
    _setAssetSources(assets, sources);
  }

  /// @param fallbackOracle The address of the fallbackOracle
  function setFallbackOracle(address fallbackOracle) external aclHas(AccessFlags.ORACLE_ADMIN) {
    _setFallbackOracle(fallbackOracle);
  }

  function _setAssetSources(address[] memory assets, address[] memory sources) internal {
    require(assets.length == sources.length, 'INCONSISTENT_PARAMS_LENGTH');
    for (uint256 i = 0; i < assets.length; i++) {
      require(sources[i] != address(this), 'ILLEGAL_SOURCE');
      _assetsSources[assets[i]] = IPriceFeed(sources[i]);

      // This event MUST happen before source's events
      emit AssetSourceUpdated(assets[i], sources[i]);

      _updateAssetSource(IPriceFeed(sources[i]));
    }
  }

  function _setFallbackOracle(address fallbackOracle) internal {
    _fallbackOracle = IPriceOracleGetter(fallbackOracle);
    emit FallbackOracleUpdated(fallbackOracle);
  }

  /// @notice Gets an asset price by address
  /// @param asset The asset address
  function getAssetPrice(address asset) public view override returns (uint256) {
    IPriceFeed source = _assetsSources[asset];
    if (address(source) != address(0)) {
      int256 price = source.latestAnswer();
      if (price > 0) {
        return uint256(price);
      }
    }

    if (asset == _quote) {
      uint256 price = _quoteValue;
      if (price > 0) {
        return price;
      }
    }

    if (address(_fallbackOracle) != address(0)) {
      uint256 price = _fallbackOracle.getAssetPrice(asset);
      if (price > 0) {
        return price;
      }
    }
    revert('UNKNOWN_ASSET');
  }

  /// @notice Gets a list of prices from a list of assets addresses
  /// @param assets The list of assets addresses
  function getAssetsPrices(address[] calldata assets) external view override returns (uint256[] memory) {
    uint256[] memory prices = new uint256[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      prices[i] = getAssetPrice(assets[i]);
    }
    return prices;
  }

  /// @notice Gets the address of the source for an asset address
  /// @param asset The address of the asset
  /// @return address The address of the source
  function getSourceOfAsset(address asset) public view returns (address) {
    return address(_assetsSources[asset]);
  }

  function getAssetSources(address[] calldata assets) external view returns (address[] memory result) {
    result = new address[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      result[i] = getSourceOfAsset(assets[i]);
    }
    return result;
  }

  /// @notice Gets the address of the fallback oracle
  /// @return address The addres of the fallback oracle
  function getFallbackOracle() external view returns (address) {
    return address(_fallbackOracle);
  }

  function updateAssetSource(address asset) external override {
    _updateAssetSource(_assetsSources[asset]);
  }

  function _updateAssetSource(IPriceFeed source) private {
    if (source != IPriceFeed(address(0)) && source.latestRound() == type(uint256).max) {
      source.updatePrice();
    }
  }
}
