// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/WadRayMath.sol';
import '../../tools/math/InterestMath.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import '../../interfaces/IPoolToken.sol';
import '../../interfaces/IDerivedToken.sol';
import '../../interfaces/IPriceOracle.sol';
import './DelegatedStrategyBase.sol';

abstract contract DelegatedStrategyCompoundBase is DelegatedStrategyBase {
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;

  uint32 private _msecPerBlock;
  uint32 private _lastBlock = uint32(block.number);
  uint32 private _lastTS = uint32(block.timestamp);

  function getDelegatedState(address asset, uint40) external override returns (DelegatedState memory result) {
    require(ICToken(asset).accrueInterest() == 0, 'CToken: accrueInterest failed');
    uint256 rate = ICToken(asset).supplyRatePerBlock().wadToRay();

    uint32 msecPerBlock = _msecPerBlock;
    if (_lastBlock < uint32(block.number)) {
      _updateAssetSource(asset);
      uint256 v = ((block.timestamp - _lastTS) * 1000) / uint32(block.number - _lastBlock);
      if (msecPerBlock > 0) {
        v += msecPerBlock * 3;
        v /= 4;
        require(v < type(uint32).max);
      }
      msecPerBlock = uint32(v);
      _lastTS = uint32(block.timestamp);
      _lastBlock = uint32(block.number);
      _msecPerBlock = msecPerBlock;
    }

    // Compound uses per-block rate, while the lending pool uses per-annum rate
    rate *= InterestMath.MILLIS_PER_YEAR / msecPerBlock;
    require(rate <= type(uint128).max);

    return
      DelegatedState({
        liquidityIndex: uint128(WadRayMath.RAY),
        variableBorrowIndex: uint128(WadRayMath.RAY),
        liquidityRate: uint128(rate),
        variableBorrowRate: 0,
        stableBorrowRate: 0,
        lastUpdateTimestamp: uint32(block.timestamp)
      });
  }

  function _updateAssetSource(address asset) private {
    if (_addressProvider != IPriceOracleProvider(address(0))) {
      IPriceOracle oracle = IPriceOracle(_addressProvider.getPriceOracle());
      oracle.updateAssetSource(asset);
    }
  }

  function getDelegatedDepositIndex(address) external pure override returns (uint256) {
    return WadRayMath.RAY; // CToken doesn't need indexing
  }

  function internalRedeem(address asset, uint256 amount) internal returns (uint256) {
    if (amount == type(uint256).max) {
      amount = ICToken(asset).balanceOfUnderlying(address(this));
    }
    require(ICToken(asset).redeemUnderlying(amount) == 0, 'CToken: redeem failed');
    return amount;
  }
}
