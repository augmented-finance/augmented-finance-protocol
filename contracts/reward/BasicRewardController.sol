// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';

import {IRewardController} from './interfaces/IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';

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

  event RewardsAllocated(address indexed user, uint256 amount);
  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

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

  function admin_addRewardProvider(
    address pool,
    address provider,
    address token
  ) external onlyOwner {
    IManagedRewardPool(pool).addRewardProvider(provider, token);
  }

  function admin_removeRewardProvider(address pool, address provider) external onlyOwner {
    IManagedRewardPool(pool).removeRewardProvider(provider);
  }

  function admin_updateBaseline(uint256 baseline) external onlyOwner {
    for (uint256 i = 0; i < _poolList.length; i++) {
      _poolList[i].updateBaseline(baseline);
    }
  }

  function admin_setPoolRate(address pool, uint256 rate) external onlyOwner {
    IManagedRewardPool(pool).setRate(rate);
  }

  function admin_setRewardMinter(IRewardMinter minter) external onlyOwner {
    _rewardMinter = minter;
  }

  function getRewardMinter() external view returns (address) {
    return address(_rewardMinter);
  }

  function claimReward() external returns (uint256 amount) {
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

  function allocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock
  ) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask != 0, 'unknown pool');

    if (_memberOf[holder] & poolMask != poolMask) {
      _memberOf[holder] |= poolMask;
    }
    if (allocated > 0) {
      internalAllocatedByPool(holder, allocated, sinceBlock, uint32(block.number));
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
  ) private returns (uint256 totalAmount) {
    mask &= ~_ignoreMask;

    if (mask == 0) {
      return 0;
    }
    mask &= _memberOf[holder];
    if (mask == 0) {
      return 0;
    }

    uint32 sinceBlock = 0;
    uint256 amountSince = 0;
    uint32 currentBlock = uint32(block.number);

    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      (uint256 amount_, uint32 since_) = _poolList[i].claimRewardFor(holder);
      if (amount_ == 0) {
        continue;
      }

      if (sinceBlock == since_) {
        amountSince = amountSince.add(amount_);
        continue;
      }

      if (amountSince > 0) {
        totalAmount = totalAmount.add(
          internalClaimByCall(holder, amountSince, sinceBlock, currentBlock)
        );
      }
      amountSince = amount_;
      sinceBlock = since_;
    }

    if (amountSince > 0) {
      totalAmount = totalAmount.add(
        internalClaimByCall(holder, amountSince, sinceBlock, currentBlock)
      );
    }

    if (totalAmount > 0) {
      address mintTo = receiver;
      for (IRewardMinter minter = _rewardMinter; minter != IRewardMinter(0); ) {
        (minter, mintTo) = minter.mintReward(mintTo, totalAmount);
      }
      emit RewardsClaimed(holder, receiver, totalAmount);
    }
    console.log('RewardsClaimed', totalAmount);
    return totalAmount;
  }

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal virtual;

  function internalClaimByCall(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock
  ) internal virtual returns (uint256 amount);
}
