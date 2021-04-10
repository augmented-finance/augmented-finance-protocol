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

  uint256 private _totalSupply;
  uint256 private _totalMax;
  uint8 private _safeBits;
  uint256 private _accumRate;

  constructor(IRewardController controller, uint256 maxTotalSupply)
    public
    AccumulatingRewardPool(controller)
  {
    require(maxTotalSupply > 0, 'max total supply is unknown');
    require(maxTotalSupply <= type(uint224).max, 'max total supply is too high');

    _totalMax = WadRayMath.WAD;
    uint256 safeBits = 256 - 60;
    for (;;) {
      uint256 next = _totalMax.mul(WadRayMath.WAD_RAY_RATIO);
      if (next >= maxTotalSupply) {
        break;
      }
      _totalMax = next;
      safeBits = safeBits.sub(30);
    }
    require(_safeBits >= 32, 'inconsistent safeBits');
    _safeBits = uint8(safeBits) + 1;
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual override {
    if (_totalSupply > 0) {
      lastRate = lastRate.mul(_totalMax.div(_totalSupply));
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

    uint256 weightedRate = internalGetRate().mul(_totalMax.div(_totalSupply));
    adjRate = _accumRate.add(weightedRate.mul(currentBlock - internalGetLastUpdateBlock()));

    weightedRate = adjRate.sub(entry.lastAccumRate);
    if (weightedRate < _totalMax && entry.rewardBase < (1 << _safeBits)) {
      // the easy way - no chance to get an over- or under-flow
      return (adjRate, entry.rewardBase.mul(weightedRate).div(_totalMax));
    }

    // the hard way - numbers are too large for one-hit
    uint256 remainingBits = 256 - BitUtils.bitLength(weightedRate);
    uint256 baseMask = (1 << remainingBits) - 1;
    uint256 shiftedBits = 0;
    for (uint256 base = entry.rewardBase; base > 0; base >>= remainingBits) {
      allocated = allocated.add(
        ((base & baseMask).mul(weightedRate).div(_totalMax)) << shiftedBits
      );
      shiftedBits += remainingBits;
    }
    return (adjRate, allocated);
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
