// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {BasicRewardController} from './BasicRewardController.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

contract RewardBooster is BasicRewardController {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  mapping(address => uint256) private _boostRewards;
  mapping(address => uint256) private _claimableRewards;

  //  uint256 private _ignoreClaims;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    public
    BasicRewardController(accessController, rewardMinter)
  {}

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal override {
    allocated = internalApplyAllocated(holder, allocated, sinceBlock, currentBlock);
    if (allocated > 0) {
      _claimableRewards[holder] = _claimableRewards[holder].add(allocated);
    }
  }

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal override returns (uint256 amount) {
    amount = internalApplyAllocated(holder, allocated, sinceBlock, currentBlock);

    uint256 claimableReward = _claimableRewards[holder];
    if (claimableReward > 0) {
      amount = amount.add(claimableReward);
      delete (_claimableRewards[holder]);
    }

    return amount;
  }

  function internalApplyAllocated(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) private returns (uint256) {
    return 0;
  }

  function internalCalcByCall(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock,
    bool incremental
  ) internal view override returns (uint256 claimableAmount, uint256 frozenAmount) {
    return (0, 0);
  }
}
