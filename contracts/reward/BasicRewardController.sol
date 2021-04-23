// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';

import {IRewardController} from './interfaces/IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';
import {IRewardMinter} from './interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardController is Ownable, IRewardController {
  using SafeMath for uint256;

  IRewardMinter private _rewardMinter;

  IManagedRewardPool[] private _poolList;
  /* IManagedRewardPool => mask */
  mapping(address => uint256) private _poolMask;
  /* holder => masks of related pools */
  mapping(address => uint256) private _memberOf;

  uint256 private _ignoreMask;

  constructor(IRewardMinter rewardMinter) public {
    _rewardMinter = rewardMinter;
  }

  function admin_addRewardPool(IManagedRewardPool pool) external onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    require(_poolMask[address(pool)] == 0, 'already registered');
    pool.claimRewardFor(address(this)); // access check
    require(_poolList.length <= 255, 'too many pools');

    _poolMask[address(pool)] = 1 << _poolList.length;
    if (!pool.isLazy()) {
      _ignoreMask |= 1 << _poolList.length;
    }
    _poolList.push(pool);
  }

  function admin_removeRewardPool(IManagedRewardPool pool) external onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    uint256 mask = _poolMask[address(pool)];
    if (mask == 0) {
      return;
    }
    delete (_poolMask[address(pool)]);
    _ignoreMask |= mask;
  }

  function admin_updateBaseline(uint256 baseline) external onlyOwner {
    for (uint256 i = 0; i < _poolList.length; i++) {
      _poolList[i].updateBaseline(baseline);
    }
  }

  function claimReward() external returns (uint256) {
    return internalClaimAndMintReward(msg.sender, ~uint256(0), msg.sender);
  }

  function claimRewardAndTransferTo(address receiver, uint256 mask) external returns (uint256) {
    require(receiver != address(0), 'receiver is required');
    return internalClaimAndMintReward(msg.sender, mask, receiver);
  }

  function claimRewardFor(address holder, uint256 mask) external returns (uint256) {
    require(holder != address(0), 'holder is required');
    return internalClaimAndMintReward(holder, mask, holder);
  }

  function claimablePools(address holder) external view returns (uint256) {
    return _memberOf[holder] & ~_ignoreMask;
  }

  function allocatedByPool(address holder, uint256 allocated) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask != 0, 'unknown pool');

    if (_memberOf[holder] & poolMask != poolMask) {
      _memberOf[holder] |= poolMask;
    }
    if (allocated > 0) {
      internalAllocatedByPool(holder, allocated, uint32(block.number));
      emit RewardsAllocated(holder, allocated);
    }
  }

  function removedFromPool(address holder) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask == 0, 'unknown pool');

    if (_memberOf[holder] & poolMask != 0) {
      _memberOf[holder] = _memberOf[holder] & ~poolMask;
    }
  }

  function isRateController(address addr) external override returns (bool) {
    return addr == address(this);
  }

  function internalClaimAndMintReward(
    address holder,
    uint256 mask,
    address receiver
  ) private returns (uint256 amount) {
    mask &= ~_ignoreMask;
    if (mask != 0) {
      mask &= _memberOf[holder];
      for (uint256 i = 0; mask != 0; i++) {
        if (mask & 1 != 0) {
          amount = amount.add(_poolList[i].claimRewardFor(holder));
        }
        mask >>= 1;
      }
    }

    amount = internalClaimByCall(holder, amount, uint32(block.number));

    if (amount > 0 && address(_rewardMinter) != address(0)) {
      _rewardMinter.mint(receiver, amount);
    }
    emit RewardsClaimed(holder, receiver, amount);
    return amount;
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal virtual;

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) internal virtual returns (uint256 amount);
}
