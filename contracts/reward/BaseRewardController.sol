// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/interfaces/IMarketAccessController.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/AccessFlags.sol';
import './interfaces/IManagedRewardController.sol';
import './interfaces/IManagedRewardPool.sol';
import '../interfaces/IRewardMinter.sol';
import './interfaces/IRewardCollector.sol';
import '../tools/Errors.sol';

abstract contract BaseRewardController is IRewardCollector, MarketAccessBitmask, IManagedRewardController {
  IRewardMinter private _rewardMinter;

  IManagedRewardPool[] private _poolList;

  /* IManagedRewardPool =>  */
  mapping(address => uint256) private _poolDesc;
  /* holder => masks of related pools */
  mapping(address => uint256) private _memberOf;

  uint256 private _ignoreMask;
  uint256 private _baselineMask;

  bool private _paused;

  constructor(IMarketAccessController accessController, IRewardMinter rewardMinter)
    MarketAccessBitmask(accessController)
  {
    _rewardMinter = rewardMinter;
  }

  function _initialize(IMarketAccessController ac, IRewardMinter rewardMinter) internal {
    _remoteAcl = ac;
    _rewardMinter = rewardMinter;
  }

  function getAccessController() public view override returns (IMarketAccessController) {
    return _remoteAcl;
  }

  uint256 private constant POOL_ID_BITS = 16;
  uint256 private constant POOL_ID_MASK = (uint256(1) << POOL_ID_BITS) - 1;
  uint256 private constant MAX_POOL_INFO = type(uint256).max >> POOL_ID_BITS;

  function addRewardPool(IManagedRewardPool pool) external override onlyConfigAdmin {
    require(address(pool) != address(0), 'reward pool required');
    require(_poolDesc[address(pool)] == 0, 'already registered');
    require(_poolList.length <= 255, 'too many pools');

    uint256 poolMask = 1 << _poolList.length;
    _poolList.push(pool);
    _poolDesc[address(pool)] = _poolList.length;
    _baselineMask |= poolMask;

    pool.attachedToRewardController(); // access check

    emit RewardPoolAdded(address(pool), poolMask);
  }

  function removeRewardPool(IManagedRewardPool pool) external override onlyConfigAdmin {
    require(address(pool) != address(0), 'reward pool required');
    uint256 poolDesc = _poolDesc[address(pool)];
    if (poolDesc == 0) {
      return;
    }
    uint256 idx = (poolDesc & POOL_ID_MASK) - 1;
    require(_poolList[idx] == pool, 'unexpected pool');

    _poolList[idx] = IManagedRewardPool(address(0));
    delete (_poolDesc[address(pool)]);

    uint256 poolMask = 1 << idx;
    _ignoreMask |= poolMask;

    internalOnPoolRemoved(pool);

    emit RewardPoolRemoved(address(pool), poolMask);
  }

  function getPoolMask(address pool) public view override returns (uint256) {
    uint256 poolDesc = _poolDesc[address(pool)];
    if (poolDesc == 0) {
      return 0;
    }
    return 1 << ((poolDesc & POOL_ID_MASK) - 1);
  }

  function getPoolsByMask(uint256 allMask) external view override returns (address[] memory pools) {
    allMask = _limitMask(allMask) & ~_ignoreMask;
    uint256 n;
    for (uint256 mask = allMask; mask > 0; mask >>= 1) {
      if (mask & 1 != 0) {
        n++;
      }
    }

    pools = new address[](n);
    n = 0;
    for ((uint256 i, uint256 mask) = (0, allMask); n < pools.length; (i, mask) = (i + 1, mask >> 1)) {
      if (mask & 1 != 0) {
        pools[n] = address(_poolList[i]);
        n++;
      }
    }

    return pools;
  }

  function internalSetPoolInfo(address pool, uint256 info) internal {
    require(info <= MAX_POOL_INFO, 'excessive pool info');
    uint256 poolId = _poolDesc[address(pool)] & POOL_ID_MASK;
    require(poolId != 0, 'unknown pool');
    _poolDesc[address(pool)] = poolId | (info << POOL_ID_BITS);
  }

  function internalGetPoolInfo(address pool) internal view returns (uint256) {
    return _poolDesc[address(pool)] >> POOL_ID_BITS;
  }

  function internalOnPoolRemoved(IManagedRewardPool) internal virtual {}

  function updateBaseline(uint256 baseline) public override onlyRateAdmin returns (uint256 totalRate) {
    (totalRate, _baselineMask) = internalUpdateBaseline(baseline, _baselineMask);
    require(totalRate <= baseline, Errors.RW_BASELINE_EXCEEDED);
    emit BaselineUpdated(baseline, totalRate, _baselineMask);
    return totalRate;
  }

  function internalUpdateBaseline(uint256 baseline, uint256 allMask)
    internal
    virtual
    returns (uint256 totalRate, uint256)
  {
    allMask &= ~_ignoreMask;

    for ((uint8 i, uint256 mask) = (0, 1); mask <= allMask; (i, mask) = (i + 1, mask << 1)) {
      if (mask & allMask == 0) {
        if (mask == 0) break;
        continue;
      }

      (bool hasBaseline, uint256 appliedRate) = _poolList[i].updateBaseline(baseline);
      if (appliedRate != 0) {
        totalRate += appliedRate;
      } else if (!hasBaseline) {
        allMask &= ~mask;
      }
    }
    return (totalRate, allMask);
  }

  function setRewardMinter(IRewardMinter minter) external override onlyConfigAdmin {
    _rewardMinter = minter;
    emit RewardMinterSet(address(minter));
  }

  function getPools() public view override returns (IManagedRewardPool[] memory, uint256 ignoreMask) {
    return (_poolList, _ignoreMask);
  }

  function getRewardMinter() external view returns (address) {
    return address(_rewardMinter);
  }

  function claimReward() external override notPaused returns (uint256 claimed, uint256 extra) {
    return _claimReward(msg.sender, claimableMask(msg.sender, 0), msg.sender);
  }

  function claimRewardTo(address receiver, uint256 includeMask)
    external
    override
    notPaused
    returns (uint256 claimed, uint256 extra)
  {
    require(receiver != address(0), 'receiver is required');
    return _claimReward(msg.sender, claimableMask(msg.sender, includeMask), receiver);
  }

  function claimableReward(address holder) public view override returns (uint256 claimable, uint256 extra) {
    return _calcReward(holder, claimableMask(holder, 0), uint32(block.timestamp));
  }

  function claimableRewardFor(address holder, uint256 includeMask)
    external
    view
    override
    returns (uint256 claimable, uint256 extra)
  {
    return _calcReward(holder, claimableMask(holder, includeMask), uint32(block.timestamp));
  }

  function balanceOf(address holder) external view override returns (uint256) {
    if (holder == address(0)) {
      return 0;
    }
    (uint256 claimable, uint256 extra) = _calcReward(holder, claimableMask(holder, 0), uint32(block.timestamp));
    return claimable + extra;
  }

  function _limitMask(uint256 includeMask) private view returns (uint256) {
    uint256 limitMask = uint256(1) << _poolList.length;
    unchecked {
      limitMask--;
    }
    return includeMask & limitMask;
  }

  function claimableMask(address holder, uint256 includeMask) internal view virtual returns (uint256) {
    if (includeMask == 0) {
      return _memberOf[holder] & ~_ignoreMask;
    }
    return (_limitMask(includeMask) | _memberOf[holder]) & ~_ignoreMask;
  }

  function claimablePools(address holder) external view override returns (uint256) {
    return claimableMask(holder, 0);
  }

  function setClaimablePools(uint256 includeMask) external override {
    _memberOf[msg.sender] = claimableMask(msg.sender, includeMask);
  }

  function allocatedByPool(
    address holder,
    uint256 allocated,
    uint32 since,
    AllocationMode mode
  ) external override {
    uint256 poolDesc = _poolDesc[msg.sender];
    uint256 poolId = poolDesc & POOL_ID_MASK;
    require(poolId != 0, 'unknown pool');
    poolDesc >>= POOL_ID_BITS;

    if (allocated > 0) {
      internalAllocatedByPool(holder, allocated, poolDesc, since);
      emit RewardsAllocated(holder, allocated, msg.sender);
    }

    if (mode == AllocationMode.Push) {
      return;
    }

    internalSetPull(holder, 1 << (poolId - 1), mode);
  }

  function internalSetPull(
    address holder,
    uint256 mask,
    AllocationMode mode
  ) internal virtual {
    mode;
    uint256 pullMask = _memberOf[holder];
    if (pullMask & mask != mask) {
      _memberOf[holder] = pullMask | mask;
    }
  }

  function internalUnsetPull(address holder, uint256 mask) internal {
    uint256 pullMask = _memberOf[holder];
    if (pullMask & mask != 0) {
      _memberOf[holder] = pullMask & ~mask;
    }
  }

  function isRateAdmin(address addr) public view override returns (bool) {
    if (!hasRemoteAcl()) {
      return addr == address(this);
    }
    return acl_hasAnyOf(addr, AccessFlags.REWARD_RATE_ADMIN | AccessFlags.REWARD_CONFIGURATOR);
  }

  function _onlyRateAdmin() private view {
    require(isRateAdmin(msg.sender), Errors.CALLER_NOT_REWARD_RATE_ADMIN);
  }

  modifier onlyRateAdmin() {
    _onlyRateAdmin();
    _;
  }

  function isConfigAdmin(address addr) public view override returns (bool) {
    if (!hasRemoteAcl()) {
      return addr == address(this);
    }
    return acl_hasAnyOf(addr, AccessFlags.REWARD_CONFIGURATOR | AccessFlags.REWARD_CONFIG_ADMIN);
  }

  function _onlyConfigAdmin() private view {
    require(isConfigAdmin(msg.sender), Errors.CALLER_NOT_REWARD_CONFIG_ADMIN);
  }

  modifier onlyConfigAdmin() {
    _onlyConfigAdmin();
    _;
  }

  function _onlyConfigOrRateAdmin() private view {
    require(isConfigAdmin(msg.sender) || isRateAdmin(msg.sender), Errors.CALLER_NOT_REWARD_RATE_ADMIN);
  }

  modifier onlyConfigOrRateAdmin() {
    _onlyConfigOrRateAdmin();
    _;
  }

  function getPool(uint256 index) internal view returns (IManagedRewardPool) {
    return _poolList[index];
  }

  function _claimReward(
    address holder,
    uint256 mask,
    address receiver
  ) private returns (uint256 claimed, uint256 extra) {
    (claimed, extra) = internalClaimAndMintReward(holder, mask);

    if (claimed > 0) {
      extra += internalClaimed(holder, receiver, claimed);
      emit RewardsClaimed(holder, receiver, claimed);
    }
    return (claimed, extra);
  }

  function internalClaimed(
    address holder,
    address mintTo,
    uint256 amount
  ) internal virtual returns (uint256) {
    holder;
    internalMint(mintTo, amount, false);
    return 0;
  }

  function internalMint(
    address mintTo,
    uint256 amount,
    bool serviceAccount
  ) internal {
    _rewardMinter.mintReward(mintTo, amount, serviceAccount);
  }

  function internalClaimAndMintReward(address holder, uint256 mask)
    internal
    virtual
    returns (uint256 claimed, uint256 extra);

  function _calcReward(
    address holder,
    uint256 mask,
    uint32 at
  ) private view returns (uint256 claimableAmount, uint256 extraAmount) {
    require(holder != address(0), 'holder is required');
    return internalCalcClaimableReward(holder, mask, at);
  }

  function internalCalcClaimableReward(
    address holder,
    uint256 mask,
    uint32 at
  ) internal view virtual returns (uint256 claimableAmount, uint256 extraAmount);

  function internalAllocatedByPool(
    address holder,
    uint256 allocated,
    uint256 poolInfo,
    uint32 since
  ) internal virtual;

  function _notPaused() private view {
    require(!_paused, Errors.RW_REWARD_PAUSED);
  }

  modifier notPaused() {
    _notPaused();
    _;
  }

  function setPaused(bool paused) public override onlyEmergencyAdmin {
    _paused = paused;
    emit EmergencyPaused(msg.sender, paused);
  }

  function isPaused() public view override returns (bool) {
    return _paused;
  }

  function setBaselinePercentagesAndRate(
    IManagedRewardPool[] calldata pools,
    uint16[] calldata pcts,
    uint256 baseline
  ) external onlyRateAdmin {
    require(pools.length == pcts.length, 'mismatched length');
    uint256 baselineMask = _baselineMask;

    for (uint256 i = 0; i < pools.length; i++) {
      uint256 mask = getPoolMask(address(pools[i]));
      require(mask != 0, 'unknown pool');
      pools[i].setBaselinePercentage(pcts[i]);
      if (pcts[i] > 0) {
        baselineMask |= mask;
      }
    }

    _baselineMask = baselineMask;

    if (baseline != type(uint256).max) {
      updateBaseline(baseline);
    }
  }
}
