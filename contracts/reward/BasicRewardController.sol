// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {BitUtils} from '../tools/math/BitUtils.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {MarketAccessBitmask} from '../access/MarketAccessBitmask.sol';
import {AccessFlags} from '../access/AccessFlags.sol';
import {IManagedRewardController, AllocationMode} from './interfaces/IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardController is Ownable, MarketAccessBitmask, IManagedRewardController {
  using SafeMath for uint256;

  IRewardMinter private _rewardMinter;

  IManagedRewardPool[] private _poolList;
  /* IManagedRewardPool => mask */
  mapping(address => uint256) private _poolMask;
  /* holder => masks of related pools */
  mapping(address => uint256) private _memberOf;

  uint256 private _ignoreMask;
  uint256 private _baselineMask;

  bool private _paused;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter) public {
    _remoteAcl = accessController;
    _rewardMinter = rewardMinter;
  }

  event RewardsAllocated(address indexed user, uint256 amount);
  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

  function admin_addRewardPool(IManagedRewardPool pool) external override onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    require(_poolMask[address(pool)] == 0, 'already registered');
    pool.claimRewardFor(address(this)); // access check
    require(_poolList.length <= 255, 'too many pools');

    uint256 poolMask = 1 << _poolList.length;
    _poolMask[address(pool)] = poolMask;
    _baselineMask |= poolMask;
    _poolList.push(pool);
  }

  function admin_removeRewardPool(IManagedRewardPool pool) external override onlyOwner {
    require(address(pool) != address(0), 'reward pool required');
    uint256 mask = _poolMask[address(pool)];
    if (mask == 0) {
      return;
    }
    uint256 idx = BitUtils.bitLength(mask);
    require(_poolList[idx] == pool, 'unexpected pool');

    _poolList[idx] = IManagedRewardPool(0);
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

  function updateBaseline(uint256 baseline) external override onlyOwner {
    uint256 baselineMask = _baselineMask & ~_ignoreMask;

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & baselineMask == 0) {
        if (mask > baselineMask) {
          break;
        }
        continue;
      }
      if (_poolList[i].updateBaseline(baseline)) {
        continue;
      }
      baselineMask &= ~mask;
    }
    _baselineMask = baselineMask;
  }

  function admin_setRewardMinter(IRewardMinter minter) external override onlyOwner {
    _rewardMinter = minter;
  }

  function getPools() public view returns (IManagedRewardPool[] memory, uint256 ignoreMask) {
    return (_poolList, _ignoreMask);
  }

  function getRewardMinter() external view returns (address) {
    return address(_rewardMinter);
  }

  function claimReward() external returns (uint256 amount) {
    // notPaused
    return internalClaimAndMintReward(msg.sender, ~uint256(0), msg.sender);
  }

  function claimRewardAndTransferTo(address receiver, uint256 mask) external returns (uint256) {
    // notPaused
    require(receiver != address(0), 'receiver is required');
    return internalClaimAndMintReward(msg.sender, mask, receiver);
  }

  function claimRewardFor(address holder, uint256 mask) external returns (uint256) {
    // notPaused
    require(holder != address(0), 'holder is required');
    return internalClaimAndMintReward(holder, mask, holder);
  }

  function claimableReward(address holder, uint32 atBlock)
    public
    view
    returns (uint256 claimable, uint256 delayed)
  {
    return claimableRewardFor(holder, ~uint256(0), atBlock);
  }

  function claimableRewardFor(
    address holder,
    uint256 mask,
    uint32 atBlock
  ) public view returns (uint256 claimable, uint256 delayed) {
    require(holder != address(0), 'holder is required');
    if (atBlock == 0) {
      atBlock = uint32(block.number);
    } else {
      require(atBlock >= uint32(block.number), 'should be zero, current or future block');
    }
    return internalCalcClaimableReward(holder, mask, atBlock);
  }

  function balanceOf(address holder) external view returns (uint256) {
    if (holder == address(0)) {
      return 0;
    }
    (uint256 claimable, uint256 delayed) =
      internalCalcClaimableReward(holder, ~uint256(0), uint32(block.number));
    return claimable.add(delayed);
  }

  function claimablePools(address holder) external view returns (uint256) {
    return _memberOf[holder] & ~_ignoreMask;
  }

  function allocatedByPool(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    AllocationMode mode
  ) external override {
    uint256 poolMask = _poolMask[msg.sender];
    require(poolMask != 0, 'unknown pool');

    if (allocated > 0) {
      internalAllocatedByPool(holder, allocated, sinceBlock, uint32(block.number));
      emit RewardsAllocated(holder, allocated);
    }

    if (mode == AllocationMode.Push) {
      return;
    }

    uint256 pullMask = _memberOf[holder];
    if (mode == AllocationMode.UnsetPull) {
      if (pullMask & poolMask != 0) {
        _memberOf[holder] = pullMask & ~poolMask;
      }
    } else {
      if (pullMask & poolMask != poolMask) {
        _memberOf[holder] = pullMask | poolMask;
      }
    }
  }

  function isRateController(address addr) public view override returns (bool) {
    if (!hasRemoteAcl()) {
      return addr == address(this);
    }
    return acl_hasAllOf(addr, AccessFlags.REWARD_RATE_ADMIN);
  }

  function isConfigurator(address addr) public view override returns (bool) {
    return addr == owner();
  }

  function isEmergencyAdmin(address addr) public view override returns (bool) {
    if (!hasRemoteAcl()) {
      return addr == address(this);
    }
    return acl_hasAllOf(addr, AccessFlags.EMERGENCY_ADMIN);
  }

  function internalClaimAndMintReward(
    address holder,
    uint256 mask,
    address receiver
  ) private notPaused returns (uint256 claimableAmount) {
    mask &= ~_ignoreMask;
    mask &= _memberOf[holder];

    uint32 sinceBlock = 0;
    uint256 amountSince = 0;
    uint32 currentBlock = uint32(block.number);
    bool incremental = false;

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
        claimableAmount = claimableAmount.add(
          internalClaimByCall(holder, amountSince, sinceBlock, currentBlock)
        );
        incremental = true;
      }
      amountSince = amount_;
      sinceBlock = since_;
    }

    if (amountSince > 0 || !incremental) {
      claimableAmount = claimableAmount.add(
        internalClaimByCall(holder, amountSince, sinceBlock, currentBlock)
      );
    }

    if (claimableAmount > 0) {
      address mintTo = receiver;
      for (IRewardMinter minter = _rewardMinter; minter != IRewardMinter(0); ) {
        (minter, mintTo) = minter.mintReward(mintTo, claimableAmount);
      }
      emit RewardsClaimed(holder, receiver, claimableAmount);
    }
    console.log('RewardsClaimed', claimableAmount);
    return claimableAmount;
  }

  function internalCalcClaimableReward(
    address holder,
    uint256 mask,
    uint32 currentBlock
  ) private view returns (uint256 claimableAmount, uint256 delayedAmount) {
    mask &= ~_ignoreMask;
    mask &= _memberOf[holder];

    uint32 sinceBlock = 0;
    uint256 amountSince = 0;
    bool incremental = false;

    for (uint256 i = 0; mask != 0; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 == 0) {
        continue;
      }

      (uint256 amount_, uint32 since_) = _poolList[i].calcRewardFor(holder);
      if (amount_ == 0) {
        continue;
      }

      if (sinceBlock == since_) {
        amountSince = amountSince.add(amount_);
        continue;
      }

      if (amountSince > 0) {
        (uint256 ca, uint256 da) =
          internalCalcByCall(holder, amountSince, sinceBlock, currentBlock, incremental);
        claimableAmount = claimableAmount.add(ca);
        delayedAmount = delayedAmount.add(da);
        incremental = true;
      }
      amountSince = amount_;
      sinceBlock = since_;
    }

    if (amountSince > 0 || !incremental) {
      (uint256 ca, uint256 da) =
        internalCalcByCall(holder, amountSince, sinceBlock, currentBlock, incremental);
      claimableAmount = claimableAmount.add(ca);
      delayedAmount = delayedAmount.add(da);
    }

    return (claimableAmount, delayedAmount);
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

  function internalCalcByCall(
    address holder,
    uint256 allocated,
    uint32 sinceBlock,
    uint32 currentBlock,
    bool incremental
  ) internal view virtual returns (uint256 claimableAmount, uint256 delayedAmount);

  modifier notPaused() {
    require(!_paused, 'rewards are paused');
    _;
  }

  function setPaused(bool paused) public override onlyEmergencyAdmin {
    _paused = paused;
  }

  function isPaused() public view override returns (bool) {
    return _paused;
  }
}
