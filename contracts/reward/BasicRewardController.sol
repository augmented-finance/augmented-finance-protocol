// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';

import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';
import {IRewardMinter} from './IRewardMinter.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardController is Ownable, IRewardController {
  using SafeMath for uint256;

  IRewardMinter private _rewardMinter; // TODO mint-able

  IManagedRewardPool[] private _poolList;
  /* IManagedRewardPool */
  mapping(address => uint256) private _poolMask;
  /* lookupKey */
  mapping(address => IManagedRewardPool[]) private _lookups;
  /* holder */
  mapping(address => uint256) private _memberOf;

  uint256 private _notLazyMask;

  constructor(IRewardMinter rewardMinter) public {
    _rewardMinter = rewardMinter;
  }

  function admin_addRewardPool(IManagedRewardPool pool, address lookupKey) external onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    require(_poolMask[address(pool)] == 0, 'already registered');
    pool.claimRewardOnBehalf(address(this)); // access check
    require(_poolList.length <= 255, 'too many pools');

    _poolMask[address(pool)] = 1 << _poolList.length;
    if (!pool.isLazy()) {
      _notLazyMask |= 1 << _poolList.length;
    }
    _poolList.push(pool);
    if (lookupKey != address(0)) {
      _lookups[lookupKey].push(pool);
    }
  }

  function lookup(address lookupKey) external view returns (IManagedRewardPool[] memory) {
    return _lookups[lookupKey];
  }

  function claimReward() external returns (uint256) {
    return internalClaimAndMintReward(msg.sender);
  }

  function claimRewardOnBehalf(address holder) external returns (uint256) {
    require(holder != address(0), 'holder is required');
    return internalClaimAndMintReward(holder);
  }

  function allocatedByPool(address holder, uint256 allocated) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask == 0, 'unregistered pool');

    if (_memberOf[holder] & poolMask == 0) {
      _memberOf[holder] = _memberOf[holder] | poolMask;
    }

    internalAllocatedByPool(holder, allocated, uint32(block.number));
  }

  function removedFromPool(address holder) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask == 0, 'unregistered pool');

    if (_memberOf[holder] & poolMask != 0) {
      _memberOf[holder] = _memberOf[holder] & ~poolMask;
    }
  }

  function internalClaimAndMintReward(address holder) private returns (uint256 amount) {
    uint256 poolMask = _memberOf[holder] & ~_notLazyMask;
    uint256 allocated = 0;
    for (uint256 i = 0; poolMask != 0; i++) {
      if (poolMask & 1 != 0) {
        allocated = allocated.add(_poolList[i].claimRewardOnBehalf(holder));
      }
      poolMask >>= 1;
    }

    allocated = internalClaimByCall(holder, allocated, uint32(block.number));

    if (allocated > 0 && address(_rewardMinter) != address(0)) {
      _rewardMinter.mintReward(holder, allocated);
    }
    return allocated;
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
