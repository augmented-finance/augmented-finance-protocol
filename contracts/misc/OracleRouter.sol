// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/IERC20.sol';

import '../interfaces/IPriceOracleGetter.sol';
import '../interfaces/IChainlinkAggregator.sol';
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
contract OracleRouter is IPriceOracleGetter, MarketAccessBitmask {
  using SafeERC20 for IERC20;

  event WethSet(address indexed weth);
  event AssetSourceUpdated(address indexed asset, address indexed source);
  event FallbackOracleUpdated(address indexed fallbackOracle);

  mapping(address => IChainlinkAggregator) private assetsSources;
  IPriceOracleGetter private _fallbackOracle;
  // solhint-disable-next-line var-name-mixedcase
  address public immutable WETH;

  /// @notice Constructor
  /// @param assets The addresses of the assets
  /// @param sources The address of the source of each asset
  /// @param fallbackOracle The address of the fallback oracle to use if the data of an
  ///        aggregator is not consistent
  constructor(
    IMarketAccessController acl,
    address[] memory assets,
    address[] memory sources,
    address fallbackOracle,
    address weth
  ) MarketAccessBitmask(acl) {
    _setFallbackOracle(fallbackOracle);
    _setAssetsSources(assets, sources);
    WETH = weth;
    emit WethSet(weth);
  }

  /// @notice External function called by the Aave governance to set or replace sources of assets
  /// @param assets The addresses of the assets
  /// @param sources The address of the source of each asset
  function setAssetSources(address[] calldata assets, address[] calldata sources)
    external
    aclHas(AccessFlags.ORACLE_ADMIN)
  {
    _setAssetsSources(assets, sources);
  }

  /// @notice Sets the fallbackOracle
  /// @param fallbackOracle The address of the fallbackOracle
  function setFallbackOracle(address fallbackOracle) external aclHas(AccessFlags.ORACLE_ADMIN) {
    _setFallbackOracle(fallbackOracle);
  }

  /// @notice Internal function to set the sources for each asset
  /// @param assets The addresses of the assets
  /// @param sources The address of the source of each asset
  function _setAssetsSources(address[] memory assets, address[] memory sources) internal {
    require(assets.length == sources.length, 'INCONSISTENT_PARAMS_LENGTH');
    for (uint256 i = 0; i < assets.length; i++) {
      assetsSources[assets[i]] = IChainlinkAggregator(sources[i]);
      emit AssetSourceUpdated(assets[i], sources[i]);
    }
  }

  /// @notice Internal function to set the fallbackOracle
  /// @param fallbackOracle The address of the fallbackOracle
  function _setFallbackOracle(address fallbackOracle) internal {
    _fallbackOracle = IPriceOracleGetter(fallbackOracle);
    emit FallbackOracleUpdated(fallbackOracle);
  }

  /// @notice Gets an asset price by address
  /// @param asset The asset address
  function getAssetPrice(address asset) public view override returns (uint256) {
    if (asset == WETH) {
      return 1 ether;
    }

    IChainlinkAggregator source = assetsSources[asset];
    if (address(source) != address(0)) {
      int256 price = IChainlinkAggregator(source).latestAnswer();
      if (price > 0) {
        return uint256(price);
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
  function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory) {
    uint256[] memory prices = new uint256[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      prices[i] = getAssetPrice(assets[i]);
    }
    return prices;
  }

  /// @notice Gets the address of the source for an asset address
  /// @param asset The address of the asset
  /// @return address The address of the source
  function getSourceOfAsset(address asset) external view returns (address) {
    return address(assetsSources[asset]);
  }

  /// @notice Gets the address of the fallback oracle
  /// @return address The addres of the fallback oracle
  function getFallbackOracle() external view returns (address) {
    return address(_fallbackOracle);
  }
}
