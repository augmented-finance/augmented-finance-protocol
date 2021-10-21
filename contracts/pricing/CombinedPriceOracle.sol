// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './interfaces/IManagedCombinedPriceOracle.sol';
import '../interfaces/IPriceFeed.sol';

contract CombinedPriceOracle is IManagedCombinedPriceOracle {
  address private immutable _quote;
  address private _fallback;

  struct Source {
    bytes20 addr;
    uint16 flags;
    PriceSourceType sourceType;
  }

  struct Static {
    uint128 staticPrice;
    uint128 _reserved;
  }

  mapping(address => Source) private _sources;
  mapping(address => Static) private _statics;

  constructor(
    address quote,
    uint256 quoteUnit,
    address fallbackOracle,
    address[] memory assets,
    PriceSource[] memory sources
  ) {
    require(quote != address(0), 'UNKNOWN_QUOTE');
    if (fallbackOracle != address(0)) {
      _setFallback(fallbackOracle);
    }

    _quote = quote;
    _setStaticPrice(quote, address(0), quoteUnit);

    for (uint256 i = assets.length; i > 0; ) {
      i--;
      _setPriceSource(
        assets[i],
        quote,
        Source(bytes20(sources[i].source), 0, sources[i].sourceType),
        sources[i].staticPrice
      );
    }
  }

  modifier onlyOracleAdmin() virtual {
    _;
  }

  function getQuoteAsset() public view returns (address) {
    return _quote;
  }

  function getQuoteAssetAndUnit() public view returns (address, uint256) {
    return (_quote, _statics[_quote].staticPrice);
  }

  function getAssetPrice(address asset) public view override returns (uint256 v) {
    if ((v = _getAssetPrice(asset)) != 0) {
      return v;
    }
    IFallbackPriceOracle fb;
    if (address(fb = IFallbackPriceOracle(_fallback)) != address(0) && (v = fb.getAssetPrice(asset)) != 0) {
      return v;
    }
    revert('UNKNOWN_PRICE');
  }

  function _getAssetPrice(address asset) private view returns (uint256 v) {
    Source memory src = _sources[asset];
    if (src.addr != 0) {
      if (src.sourceType <= PriceSourceType.ChainlinkWithUpdate) {
        v = _getAssetPriceChainlink(address(src.addr));
      } else if (src.sourceType == PriceSourceType.UniV2EthPair) {
        v = _getAssetPriceUniV2EthPair(address(src.addr), src.flags);
      }
      if (v != 0) {
        return v;
      }
    }
    return _statics[asset].staticPrice;
  }

  function _getAssetPriceChainlink(address source) private view returns (uint256) {
    return uint256(IPriceFeed(source).latestAnswer());
  }

  function _getAssetPriceUniV2EthPair(address source, uint16 flags) private view returns (uint256) {
    source;
    flags;
    this;
    return 0;
  }

  function getAssetPrices(address[] calldata assets) public view override returns (uint256[] memory result) {
    result = new uint256[](assets.length);
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      result[i] = getAssetPrice(assets[i]);
    }
    return result;
  }

  function getPriceSource(address asset) public view override returns (PriceSource memory) {
    Source storage src = _sources[asset];
    return PriceSource(address(src.addr), _statics[asset].staticPrice, src.sourceType);
  }

  function getPriceSources(address[] calldata assets) external view override returns (PriceSource[] memory result) {
    result = new PriceSource[](assets.length);
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      result[i] = getPriceSource(assets[i]);
    }
    return result;
  }

  function setPriceSources(address[] calldata assets, PriceSource[] calldata sources)
    external
    override
    onlyOracleAdmin
  {
    address quote = _quote;
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      _setPriceSource(
        assets[i],
        quote,
        Source(bytes20(sources[i].source), 0, sources[i].sourceType),
        sources[i].staticPrice
      );
    }
  }

  function setStaticPrices(address[] calldata assets, uint256[] calldata prices) external override onlyOracleAdmin {
    address quote = _quote;
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      _setStaticPrice(assets[i], quote, prices[i]);
    }
  }

  uint256 private constant KEEP_PRICE = type(uint256).max;

  function _setPriceSource(
    address asset,
    address quote,
    Source memory src,
    uint256 staticPrice
  ) private {
    require(asset != quote);
    require(address(src.addr) != address(this), 'ILLEGAL_SOURCE');

    if (src.sourceType != PriceSourceType.Chainlink) {
      require(src.addr != 0);
    }
    _sources[asset] = src;
    emit AssetSourceUpdated(asset, address(src.addr));
    if (src.addr != 0) {
      _updateAssetSource(src);
    }
    if (staticPrice != KEEP_PRICE) {
      require(staticPrice <= type(uint128).max);
      _statics[asset].staticPrice = uint128(staticPrice);
    } else {
      staticPrice = _statics[asset].staticPrice;
    }
    if (src.addr == 0) {
      emit AssetPriceUpdated(asset, staticPrice, block.timestamp);
    }
  }

  function _setStaticPrice(
    address asset,
    address quote,
    uint256 price
  ) private {
    require(asset != quote);
    require(price <= type(uint128).max);
    _statics[asset].staticPrice = uint128(price);
    emit AssetPriceUpdated(asset, price, block.timestamp);
  }

  function getFallback() external view override returns (address) {
    return _fallback;
  }

  function setFallback(address fallbackOracle) public override onlyOracleAdmin {
    _setFallback(fallbackOracle);
  }

  function _setFallback(address fallbackOracle) private {
    _fallback = fallbackOracle;
    emit FallbackOracleUpdated(fallbackOracle);
  }

  function updateAssetSource(address asset) external override {
    _updateAssetSource(_sources[asset]);
  }

  function _updateAssetSource(Source memory src) private {
    if (src.addr != 0 && src.sourceType == PriceSourceType.ChainlinkWithUpdate) {
      IPriceFeed(address(src.addr)).updatePrice();
    }
  }

  /// @dev backward compatibility
  function setAssetSources(address[] calldata assets, address[] calldata sources) external onlyOracleAdmin {
    require(assets.length == sources.length, 'PARAMS_LENGTH');
    address quote = _quote;
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      PriceSourceType st = PriceSourceType.Chainlink;
      if (sources[i] != address(0) && IPriceFeed(sources[i]).latestRound() == type(uint256).max) {
        st = PriceSourceType.ChainlinkWithUpdate;
      }
      _setPriceSource(assets[i], quote, Source(bytes20(sources[i]), 0, st), KEEP_PRICE);
    }
  }

  /// @dev backward compatibility
  function getAssetsPrices(address[] calldata assets) external view override returns (uint256[] memory) {
    return getAssetPrices(assets);
  }

  /// @dev backward compatibility
  function getSourceOfAsset(address asset) external view returns (address) {
    return address(_sources[asset].addr);
  }

  /// @dev backward compatibility
  function getAssetSources(address[] calldata assets) external view returns (address[] memory result) {
    result = new address[](assets.length);
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      result[i] = address(_sources[assets[i]].addr);
    }
    return result;
  }

  /// @dev backward compatibility
  function setAssetPrice(address asset, uint256 price) external onlyOracleAdmin {
    _setStaticPrice(asset, _quote, price);
  }

  /// @dev backward compatibility
  function setAssetPrices(address[] calldata assets, uint256[] calldata prices) external onlyOracleAdmin {
    require(assets.length == prices.length, 'PARAMS_LENGTH');
    address quote = _quote;
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      _setStaticPrice(assets[i], quote, prices[i]);
    }
  }
}
