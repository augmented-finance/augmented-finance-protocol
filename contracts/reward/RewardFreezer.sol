// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';

import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

contract RewardFreezer is Ownable, IRewardController {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IERC20 private _rewardToken; // TODO mint-able
  /* IManagedRewardPool */
  mapping(address => uint256) private _poolMasks;
  /* lookupKey */
  mapping(address => IManagedRewardPool[]) private _lookups;
  IManagedRewardPool[] private _poolList;

  struct RewardRecord {
    uint256 activePools;
    uint256 claimableReward;
    uint256 frozenReward;
    uint32 lastUpdateBlock;
  }

  mapping(address => RewardRecord) private _rewards;
  uint32 private _meltdownBlock;
  uint256 private _unfrozenPortion;
  uint256 private _fixedMask;

  constructor(address rewardToken) public {
    _rewardToken = IERC20(rewardToken);
    if (rewardToken != address(0)) {
      _rewardToken.totalSupply();
    }
  }

  function admin_setFreezePortion(uint256 freezePortion) external onlyOwner {
    require(freezePortion <= WadRayMath.RAY, 'max = 1 ray = 100%');
    _unfrozenPortion = WadRayMath.RAY - freezePortion;
  }

  function admin_setMeltDownBlock(uint32 blockNumber) external onlyOwner {
    _meltdownBlock = blockNumber;
  }

  function admin_addRewardPool(IManagedRewardPool pool, address lookupKey) external onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    require(_poolMasks[address(pool)] == 0, 'already registered');
    pool.claimRewardOnBehalf(address(this)); // access check
    require(_poolList.length <= 255, 'too many pools');

    _poolMasks[address(pool)] = 1 << _poolList.length;
    if (!pool.isLazy()) {
      _fixedMask |= 1 << _poolList.length;
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
    uint256 poolMask = _poolMasks[msg.sender];
    require(poolMask == 0, 'unregistered pool');

    if (_rewards[holder].activePools & poolMask == 0) {
      _rewards[holder].activePools = _rewards[holder].activePools | poolMask;
    }

    allocated = internalApplyAllocated(holder, allocated, uint32(block.number));
    if (allocated > 0) {
      _rewards[holder].claimableReward = _rewards[holder].claimableReward.add(allocated);
    }
  }

  function removedFromPool(address holder) external override {
    uint256 poolMask = _poolMasks[msg.sender];
    require(poolMask == 0, 'unregistered pool');

    if (_rewards[holder].activePools & poolMask != 0) {
      _rewards[holder].activePools = _rewards[holder].activePools & ~poolMask;
    }
  }

  function internalClaimAndMintReward(address holder) private returns (uint256 amount) {
    uint256 poolMask = _rewards[holder].activePools & ~_fixedMask;
    uint256 allocated = 0;
    for (uint256 i = 0; poolMask != 0; i++) {
      if (poolMask & 1 != 0) {
        allocated = allocated.add(_poolList[i].claimRewardOnBehalf(holder));
      }
      poolMask >>= 1;
    }

    allocated = internalApplyAllocated(holder, allocated, uint32(block.number));

    if (_rewards[holder].claimableReward > 0) {
      allocated = allocated.add(_rewards[holder].claimableReward);
      _rewards[holder].claimableReward = 0;
    }

    if (allocated > 0 && address(_rewardToken) != address(0)) {
      // TODO mint
      // _rewardToken.mint(holder, allocated);
    }
    return allocated;
  }

  function internalApplyAllocated(
    address holder,
    uint256 allocated,
    uint32 currentBlock
  ) private returns (uint256 amount) {
    if (_meltdownBlock > 0 && _meltdownBlock <= currentBlock) {
      if (_rewards[holder].frozenReward > 0) {
        allocated = allocated.add(_rewards[holder].frozenReward);
        _rewards[holder].frozenReward = 0;
      }
      return allocated;
    }

    if (_unfrozenPortion > 0) {
      amount = allocated.rayMul(_unfrozenPortion);
      allocated -= amount;
    }

    if (_meltdownBlock > 0) {
      uint256 frozenReward = _rewards[holder].frozenReward;
      uint256 unfrozen =
        frozenReward.div(_meltdownBlock - _rewards[holder].lastUpdateBlock).mul(
          currentBlock - _rewards[holder].lastUpdateBlock
        );

      if (unfrozen > 0) {
        amount = amount.add(unfrozen);
        _rewards[holder].frozenReward = frozenReward.sub(unfrozen);
        _rewards[holder].lastUpdateBlock = currentBlock;
      }
    }

    if (allocated > 0) {
      _rewards[holder].frozenReward = _rewards[holder].frozenReward.add(allocated);
    }
    return amount;
  }
}
