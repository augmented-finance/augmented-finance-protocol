// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {BitUtils} from '../protocol/libraries/math/BitUtils.sol';
import {IRewardController} from './IRewardController.sol';
import {AccumulatingRewardPool} from './AccumulatingRewardPool.sol';

import 'hardhat/console.sol';

contract LinearWeightedRewardPool is AccumulatingRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;
  uint256 private _totalSupply;

  uint256 private _totalSupplyMax;
  uint256 private constant minBitReserve = 32;

  constructor(IRewardController controller, uint256 maxTotalSupply)
    public
    AccumulatingRewardPool(controller)
  {
    require(maxTotalSupply > 0, 'max total supply is unknown');

    uint256 maxSupplyBits = BitUtils.bitLength(maxTotalSupply);
    require(maxSupplyBits + minBitReserve > 256, 'max total supply is too high');

    _totalSupplyMax = (1 << maxSupplyBits) - 1;
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual override {
    if (_totalSupply > 0) {
      // the rate stays in RAY, but is weighted now vs _totalSupplyMax
      lastRate = lastRate.mul(_totalSupplyMax.div(_totalSupply));
      _accumRate = _accumRate.add(lastRate.mul(currentBlock - lastBlock));
    } else {
      lastRate = 0;
    }
    super.internalRateUpdated(lastRate, lastBlock, currentBlock);
  }

  function internalSetTotalSupply(uint256 totalSupply, uint32 currentBlock) internal {
    if (internalGetRate() > 0) {
      // updates are not needed when the rate is zero, unset or was set within this block
      uint32 lastBlock = internalGetLastUpdateBlock();
      if (lastBlock != 0 && lastBlock != currentBlock) {
        internalRateUpdated(internalGetRate(), lastBlock, currentBlock);
      }
    }
    _totalSupply = totalSupply;
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    override
    returns (uint256 adjRate, uint256 allocated)
  {
    if (_totalSupply == 0) {
      return (_accumRate, 0);
    }

    uint256 weightedRate = internalGetRate().mul(_totalSupplyMax.div(_totalSupply));
    adjRate = _accumRate.add(weightedRate.mul(currentBlock - internalGetLastUpdateBlock()));

    weightedRate = adjRate.sub(entry.lastAccumRate);
    // ATTN! TODO Prevent overflow checks here
    uint256 x = entry.rewardBase * weightedRate;
    if (x / weightedRate == entry.rewardBase) {
      // the easy way - no overflow
      return (adjRate, (x / _totalSupplyMax) / WadRayMath.RAY);
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
    return (adjRate, allocated / WadRayMath.RAY);
  }

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal virtual override returns (uint256) {
    if (_totalSupply != totalSupply) {
      internalSetTotalSupply(totalSupply, currentBlock);
    }
    return super.internalUpdateReward(holder, oldBalance, newBalance, totalSupply, currentBlock);
  }
}
