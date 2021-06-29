// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {CalcLinearRateReward} from './CalcLinearRateReward.sol';

import 'hardhat/console.sol';

abstract contract CalcLinearWeightedReward is CalcLinearRateReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;
  uint256 private _totalSupply;

  uint256 private _totalSupplyMax;
  uint256 private constant minBitReserve = 32;

  constructor(uint256 maxTotalSupply) public {
    require(maxTotalSupply > 0, 'max total supply is unknown');

    uint256 maxSupplyBits = BitUtils.bitLength(maxTotalSupply);
    require(maxSupplyBits + minBitReserve < 256, 'max total supply is too high');

    _totalSupplyMax = (1 << maxSupplyBits) - 1;
  }

  function doUpdateTotalSupplyDiff(uint256 oldSupply, uint256 newSupply) internal returns (bool) {
    if (newSupply > oldSupply) {
      return internalSetTotalSupply(_totalSupply.add(newSupply - oldSupply), getCurrentTick());
    }
    if (oldSupply > newSupply) {
      return internalSetTotalSupply(_totalSupply.sub(oldSupply - newSupply), getCurrentTick());
    }
    return false;
  }

  function doUpdateTotalSupply(uint256 newSupply) internal returns (bool) {
    if (newSupply == _totalSupply) {
      return false;
    }
    return internalSetTotalSupply(newSupply, getCurrentTick());
  }

  function doUpdateTotalSupplyAt(uint256 newSupply, uint32 at) internal returns (bool) {
    if (newSupply == _totalSupply) {
      return false;
    }
    return internalSetTotalSupply(newSupply, at);
  }

  function internalRateUpdated(uint256 lastRate, uint32 lastAt) internal override {
    console.log('internalRateUpdated', lastAt, lastRate, _totalSupply);
    if (_totalSupply == 0) {
      return;
    }

    uint32 currentTick = getRateUpdatedAt();
    console.log('internalRateUpdated_1', currentTick, lastRate, _accumRate);

    // the rate stays in RAY, but is weighted now vs _totalSupplyMax
    if (currentTick != lastAt) {
      lastRate = lastRate.mul(_totalSupplyMax.div(_totalSupply));
      console.log('internalRateUpdated_1a', lastRate, _totalSupplyMax, _totalSupply);
      _accumRate = _accumRate.add(lastRate.mul(currentTick - lastAt));
    }
    console.log('internalRateUpdated_2', _accumRate);
  }

  function internalSetTotalSupply(uint256 totalSupply, uint32 at)
    internal
    returns (bool rateUpdated)
  {
    uint256 lastRate = getLinearRate();
    uint32 lastAt = getRateUpdatedAt();
    internalMarkRateUpdate(at);

    if (lastRate > 0) {
      internalRateUpdated(lastRate, lastAt);
      rateUpdated = lastAt != at;
    }

    _totalSupply = totalSupply;
    return rateUpdated;
  }

  function internalGetLastAccumRate() internal view returns (uint256) {
    return _accumRate;
  }

  function internalGetAccumHistory(uint32 at) internal view virtual returns (uint256) {
    require(at >= getRateUpdatedAt(), 'lookback for accumulated rate');
    return _accumRate;
  }

  function internalCalcRateAndReward(
    RewardEntry memory entry,
    uint256 lastAccumRate,
    uint32 currentTick
  )
    internal
    view
    override
    returns (
      uint256 adjRate,
      uint256 allocated,
      uint32 since
    )
  {
    uint256 weightedRate;

    adjRate = internalGetAccumHistory(currentTick);
    if (_totalSupply > 0) {
      weightedRate = getLinearRate().mul(_totalSupplyMax.div(_totalSupply));
      adjRate = adjRate.add(weightedRate.mul(currentTick - getRateUpdatedAt()));
    }
    weightedRate = adjRate.sub(lastAccumRate);

    if (weightedRate == 0) {
      return (adjRate, 0, entry.lastUpdate);
    }

    // ATTN! TODO Prevent overflow checks here
    uint256 x = entry.rewardBase * weightedRate;
    if (x / weightedRate == entry.rewardBase) {
      // the easy way - no overflow
      return (adjRate, (x / _totalSupplyMax) / WadRayMath.RAY, entry.lastUpdate);
    }

    // the hard way - numbers are too large for one-hit, so do it by chunks
    uint256 remainingBits =
      minBitReserve + uint256(256 - minBitReserve).sub(BitUtils.bitLength(weightedRate));
    uint256 baseMask = (1 << remainingBits) - 1;
    uint256 shiftedBits = 0;

    for (x = entry.rewardBase; x > 0; x >>= remainingBits) {
      allocated = allocated.add((((x & baseMask) * weightedRate) / _totalSupplyMax) << shiftedBits);
      shiftedBits += remainingBits;
    }
    return (adjRate, allocated / WadRayMath.RAY, entry.lastUpdate);
  }
}
