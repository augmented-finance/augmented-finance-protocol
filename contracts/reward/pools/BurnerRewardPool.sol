// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IManagedRewardPool.sol';
import {PermitRewardPool} from './PermitRewardPool.sol';
import {CalcLinearFreezer} from '../calcs/CalcLinearFreezer.sol';

import 'hardhat/console.sol';

contract BurnerRewardPool is PermitRewardPool, CalcLinearFreezer {
  constructor(
    IRewardController controller,
    uint256 rewardLimit,
    string memory rewardPoolName
  ) public PermitRewardPool(controller, rewardLimit, rewardPoolName) {}

  function setFreezePercentage(uint32 freezePortion) external onlyController {
    internalSetFreezePercentage(freezePortion);
  }

  function setMeltDownAt(uint32 at) external onlyController {
    internalSetMeltDownAt(at);
  }

  function internalGetReward(address holder, uint256)
    internal
    override
    returns (uint256 allocated, uint32)
  {
    (allocated, ) = doClaimByPull(holder, 0, 0);
    return (allocated, uint32(block.timestamp));
  }

  function internalCalcReward(address holder)
    internal
    view
    override
    returns (uint256 allocated, uint32)
  {
    (allocated, ) = doCalcByPull(holder, 0, 0, false);
    return (allocated, uint32(block.timestamp));
  }

  function internalPushReward(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal override {
    doAllocatedByPush(holder, allocated, since);
  }
}
