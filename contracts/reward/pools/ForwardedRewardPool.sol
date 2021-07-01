// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IForwardedRewardPool} from '../interfaces/IForwardedRewardPool.sol';
import {IForwardingRewardPool} from '../interfaces/IForwardingRewardPool.sol';

import 'hardhat/console.sol';

abstract contract ForwardedRewardPool is IForwardedRewardPool {
  IForwardingRewardPool private _forwarder;

  function internalSetForwarder(IForwardingRewardPool forwarder) internal {
    _forwarder = forwarder;
  }

  modifier onlyForwarder() {
    require(msg.sender == address(_forwarder), 'only forwarder');
    _;
  }

  function claimReward(address holder, uint256 limit)
    external
    override
    onlyForwarder
    returns (uint256 amount, uint32 since)
  {
    return internalClaimReward(holder, limit);
  }

  function internalClaimReward(address holder, uint256 limit)
    internal
    virtual
    returns (uint256 amount, uint32 since);

  function setRewardRate(uint256 rate) external override onlyForwarder {
    internalSetRewardRate(rate);
  }

  function internalSetRewardRate(uint256) internal virtual;

  function internalAllocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) internal {
    _forwarder.allocateReward(holder, allocated, since, mode);
  }
}
