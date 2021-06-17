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
      return internalSetTotalSupply(_totalSupply.add(newSupply - oldSupply));
    }
    if (oldSupply > newSupply) {
      return internalSetTotalSupply(_totalSupply.sub(oldSupply - newSupply));
    }
    return false;
  }

  function doUpdateTotalSupply(uint256 newSupply) internal returns (bool) {
    if (newSupply == _totalSupply) {
      return false;
    }
    return internalSetTotalSupply(newSupply);
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal override {
    if (_totalSupply == 0) {
      return;
    }

    // the rate stays in RAY, but is weighted now vs _totalSupplyMax
    if (currentBlock != lastBlock) {
      lastRate = lastRate.mul(_totalSupplyMax.div(_totalSupply));
      _accumRate = _accumRate.add(lastRate.mul(currentBlock - lastBlock));
    }
  }

  function internalSetTotalSupply(uint256 totalSupply) internal returns (bool rateUpdated) {
    uint256 lastRate = getLinearRate();
    if (lastRate > 0) {
      uint32 currentBlock = getCurrentBlock();
      uint32 lastBlock = getRateUpdateBlock();
      internalRateUpdated(lastRate, lastBlock, currentBlock);
      rateUpdated = lastBlock != currentBlock;
    }

    _totalSupply = totalSupply;
    return rateUpdated;
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    override
    returns (
      uint256 adjRate,
      uint256 allocated,
      uint32 since
    )
  {
    if (_totalSupply == 0) {
      return (_accumRate, 0, 0);
    }

    uint256 weightedRate = getLinearRate().mul(_totalSupplyMax.div(_totalSupply));
    adjRate = _accumRate.add(weightedRate.mul(currentBlock - getRateUpdateBlock()));

    weightedRate = adjRate.sub(entry.lastAccumRate);
    // ATTN! TODO Prevent overflow checks here
    uint256 x = entry.rewardBase * weightedRate;
    if (x / weightedRate == entry.rewardBase) {
      // the easy way - no overflow
      return (adjRate, (x / _totalSupplyMax) / WadRayMath.RAY, entry.lastUpdateBlock);
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
    return (adjRate, allocated / WadRayMath.RAY, entry.lastUpdateBlock);
  }
}
