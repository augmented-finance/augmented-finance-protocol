// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {BitUtils} from '../../tools/math/BitUtils.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {AllocationMode} from '../interfaces/IRewardController.sol';
import {CalcLinearRateReward} from './CalcLinearRateReward.sol';

import 'hardhat/console.sol';

abstract contract CalcCheckpointWeightedReward is CalcLinearRateReward {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private _accumRate;
  mapping(uint32 => uint256) private _accumHistory;

  uint256 private _totalSupplyMax;
  uint256 private constant minBitReserve = 32;

  constructor(uint256 maxTotalSupply) public {
    require(maxTotalSupply > 0, 'max total supply is unknown');

    uint256 maxSupplyBits = BitUtils.bitLength(maxTotalSupply);
    require(maxSupplyBits + minBitReserve < 256, 'max total supply is too high');

    _totalSupplyMax = maxTotalSupply; // (1 << maxSupplyBits) - 1;
  }

  function internalTotalSupply() internal view virtual returns (uint256);

  function internalExtraRate() internal view virtual returns (uint256);

  function doCheckpoint(uint32 at) internal {
    (uint256 lastRate, uint32 lastAt) = getRateAndUpdatedAt();
    internalMarkRateUpdate(at);
    internalRateUpdated(lastRate, lastAt, at);

    _accumHistory[at] = _accumRate + 1;
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastAt,
    uint32 at
  ) internal override {
    // console.log('internalRateUpdated', lastRate, lastAt, at);

    if (at == lastAt) {
      return;
    }

    uint256 totalSupply = internalTotalSupply();
    // console.log('internalRateUpdated', totalSupply, internalExtraRate(), _totalSupplyMax);
    // console.log('internalRateUpdated', _accumRate);

    if (totalSupply == 0) {
      return;
    }

    lastRate = lastRate.add(internalExtraRate());
    // the rate stays in RAY, but is weighted now vs _totalSupplyMax
    lastRate = lastRate.mul(_totalSupplyMax.div(totalSupply));
    _accumRate = _accumRate.add(lastRate.mul(at - lastAt));

    // console.log('internalRateUpdated', _accumRate);
  }

  function isHistory(uint32 at) internal view virtual returns (bool);

  function internalCalcRateAndReward(
    RewardEntry memory entry,
    uint256 lastAccumRate,
    uint32 at
  )
    internal
    view
    virtual
    override
    returns (
      uint256 adjRate,
      uint256 allocated,
      uint32 since
    )
  {
    if (isHistory(at)) {
      adjRate = _accumHistory[at];
      require(adjRate > 0, 'unknown history point');
      adjRate--;
    } else {
      adjRate = _accumRate;
      uint256 totalSupply = internalTotalSupply();

      if (totalSupply > 0) {
        (uint256 rate, uint32 updatedAt) = getRateAndUpdatedAt();

        // console.log('internalCalcRateAndReward', rate, internalExtraRate());
        rate = rate.add(internalExtraRate());
        rate = rate.mul(_totalSupplyMax.div(totalSupply));
        adjRate = adjRate.add(rate.mul(at - updatedAt));
      }
    }

    if (adjRate == lastAccumRate || entry.rewardBase == 0) {
      return (adjRate, 0, entry.claimedAt);
    }

    uint256 v = mulDiv(entry.rewardBase, adjRate.sub(lastAccumRate), _totalSupplyMax);
    return (adjRate, v.div(WadRayMath.RAY), entry.claimedAt);
  }
}
