// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/PercentageMath.sol';
import '../../tools/Errors.sol';
import '../interfaces/IRewardController.sol';
import '../calcs/CalcLinearUnweightedReward.sol';
import './ControlledRewardPool.sol';

contract TeamRewardPool is ControlledRewardPool, CalcLinearUnweightedReward {
  using PercentageMath for uint256;

  address private _teamManager;
  address private _excessTarget;
  uint32 private _lockupTill;
  uint16 private _totalShare;

  mapping(address => uint256) private _delayed;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address teamManager
  ) ControlledRewardPool(controller, initialRate, baselinePercentage) {
    _teamManager = teamManager;
  }

  function _onlyTeamManagerOrConfigurator() private view {
    require(msg.sender == _teamManager || _isConfigAdmin(msg.sender), Errors.CALLER_NOT_TEAM_MANAGER);
  }

  modifier onlyTeamManagerOrConfigurator() {
    _onlyTeamManagerOrConfigurator();
    _;
  }

  function getPoolName() public pure override returns (string memory) {
    return 'TeamPool';
  }

  function getExcessTarget() external view returns (address) {
    return _excessTarget;
  }

  event ExcessTargetUpdated(address indexed target);

  function setExcessTarget(address target) external onlyTeamManagerOrConfigurator {
    require(target != address(this));
    _excessTarget = target;
    if (target != address(0)) {
      internalAllocateReward(target, 0, uint32(block.timestamp), AllocationMode.SetPull);
    }
    emit ExcessTargetUpdated(target);
  }

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate) internal override {
    super.setLinearRate(newRate);
  }

  function internalCalcRateAndReward(
    RewardBalance memory entry,
    uint256 lastAccumRate,
    uint32 currentBlock
  )
    internal
    view
    override
    returns (
      uint256 rate,
      uint256 allocated,
      uint32 since
    )
  {
    (rate, allocated, since) = super.internalCalcRateAndReward(entry, lastAccumRate, currentBlock);
    allocated = (allocated + PercentageMath.HALF_ONE) / PercentageMath.ONE;
    return (rate, allocated, since);
  }

  function addRewardProvider(address, address) external view override onlyConfigAdmin {
    revert('UNSUPPORTED');
  }

  function removeRewardProvider(address) external override onlyConfigAdmin {}

  function getAllocatedShares() external view returns (uint16) {
    return _totalShare;
  }

  function isUnlocked(uint32 at) public view returns (bool) {
    return _lockupTill > 0 && _lockupTill < at;
  }

  function internalAttachedToRewardController() internal override {
    _updateTeamExcess();
  }

  function updateTeamMembers(address[] calldata members, uint16[] calldata memberSharePct)
    external
    onlyTeamManagerOrConfigurator
  {
    require(members.length == memberSharePct.length);
    for (uint256 i = 0; i < members.length; i++) {
      _updateTeamMember(members[i], memberSharePct[i]);
    }
    _updateTeamExcess();
  }

  function updateTeamMember(address member, uint16 memberSharePct) external onlyTeamManagerOrConfigurator {
    _updateTeamMember(member, memberSharePct);
    _updateTeamExcess();
  }

  event TeamMemberShareUpdated(address indexed member, uint16 memberSharePct);

  function _updateTeamMember(address member, uint16 memberSharePct) private {
    require(member != address(0), 'member is required');
    require(member != address(this), 'member is invalid');
    require(memberSharePct <= PercentageMath.ONE, 'invalid share percentage');

    uint256 newTotalShare = (uint256(_totalShare) + memberSharePct) - getRewardEntry(member).rewardBase;
    require(newTotalShare <= PercentageMath.ONE, 'team total share exceeds 100%');
    _totalShare = uint16(newTotalShare);
    emit TeamMemberShareUpdated(member, memberSharePct);

    (uint256 allocated, uint32 since, AllocationMode mode) = doUpdateRewardBalance(member, memberSharePct);

    if (isUnlocked(getCurrentTick())) {
      allocated = _popDelayed(member, allocated);
    } else if (allocated > 0) {
      _delayed[member] += allocated;
      if (mode == AllocationMode.Push) {
        return;
      }
      allocated = 0;
    }

    internalAllocateReward(member, allocated, since, mode);
  }

  function _popDelayed(address holder, uint256 amount) private returns (uint256) {
    uint256 d = _delayed[holder];
    if (d == 0) {
      return amount;
    }
    delete (_delayed[holder]);
    return amount + d;
  }

  function _updateTeamExcess() private {
    uint256 excess = PercentageMath.ONE - _totalShare;
    (uint256 allocated, , ) = doUpdateRewardBalance(address(this), excess);
    if (allocated > 0) {
      _delayed[address(this)] += allocated;
    }
    emit TeamMemberShareUpdated(address(0), uint16(excess));
  }

  event TeamManagerUpdated(address indexed manager);

  function setTeamManager(address manager) external onlyTeamManagerOrConfigurator {
    _teamManager = manager;
    emit TeamManagerUpdated(manager);
  }

  function getTeamManager() external view returns (address) {
    return _teamManager;
  }

  event UnlockedAtUpdated(uint32 at);

  function setUnlockedAt(uint32 at) external onlyConfigAdmin {
    require(at > 0, 'unlockAt is required');
    require(_lockupTill == 0 || _lockupTill >= getCurrentTick(), 'lockup is finished');
    _lockupTill = at;
    emit UnlockedAtUpdated(at);
  }

  function getUnlockedAt() external view returns (uint32) {
    return _lockupTill;
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalGetReward(address holder)
    internal
    override
    returns (
      uint256 allocated,
      uint32 since,
      bool keep
    )
  {
    if (!isUnlocked(getCurrentTick())) {
      return (0, 0, true);
    }
    (allocated, since, keep) = doGetReward(holder);
    allocated = _popDelayed(holder, allocated);

    if (holder != _excessTarget) {
      return (allocated, since, keep);
    }

    (uint256 allocated2, uint32 since2, ) = doGetReward(address(this));
    allocated2 = _popDelayed(address(this), allocated2);

    return (allocated + allocated2, since2 > since ? since2 : since, true);
  }

  function internalCalcReward(address holder, uint32 at) internal view override returns (uint256, uint32) {
    (uint256 allocated, uint32 since) = doCalcRewardAt(holder, at);
    allocated += _delayed[holder];

    if (holder != _excessTarget) {
      return (allocated, since);
    }

    (uint256 allocated2, uint32 since2) = doCalcRewardAt(address(this), at);
    allocated2 += _delayed[address(this)];

    return (allocated + allocated2, since2 > since ? since2 : since);
  }

  function calcRewardFor(address holder, uint32 at)
    external
    view
    override
    returns (
      uint256 amount,
      uint256 delayedAmount,
      uint32 since
    )
  {
    (amount, since) = internalCalcReward(holder, at);
    if (!isUnlocked(at)) {
      (amount, delayedAmount) = (0, amount);
    }
    return (amount, delayedAmount, since);
  }
}
