// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {IRewardController} from './../interfaces/IRewardController.sol';
import {BaseRateRewardPool} from './BaseRateRewardPool.sol';
import {CalcLinearUnweightedReward} from './CalcLinearUnweightedReward.sol';

import 'hardhat/console.sol';

contract TeamRewardPool is BaseRateRewardPool, CalcLinearUnweightedReward {
  using PercentageMath for uint256;

  address private _teamManager;
  uint256 private _accumRate;
  uint32 private _lockupBlock;
  uint16 private _totalShare;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address teamManager
  ) public BaseRateRewardPool(controller, initialRate, baselinePercentage) {
    _teamManager = teamManager;
  }

  modifier onlyTeamManagerOrController() {
    require(
      msg.sender == _teamManager || isController(msg.sender),
      'only team manager or controller'
    );
    _;
  }

  function isLazy() public view override returns (bool) {
    return true;
  }

  function getRate() public view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 newRate, uint32 currentBlock) internal override {
    super.setLinearRate(newRate, currentBlock);
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    override
    returns (uint256, uint32)
  {
    if (!isUnlocked(currentBlock)) {
      return (0, 0);
    }
    return doGetReward(holder, currentBlock);
  }

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    override
    returns (uint256, uint32)
  {
    if (!isUnlocked(currentBlock)) {
      return (0, 0);
    }
    return doCalcReward(holder, currentBlock);
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    override
    returns (
      uint256 rate,
      uint256 allocated,
      uint32 since
    )
  {
    (rate, allocated, since) = super.internalCalcRateAndReward(entry, currentBlock);
    allocated /= PercentageMath.ONE;
    return (rate, allocated, since);
  }

  function addRewardProvider(address, address) external override {
    revert('unsupported');
  }

  function removeRewardProvider(address) external override {
    revert('unsupported');
  }

  function getAllocatedShares() external view returns (uint16) {
    return _totalShare;
  }

  function isUnlocked(uint32 blockNumber) public view returns (bool) {
    return _lockupBlock > 0 && _lockupBlock < blockNumber;
  }

  function updateTeamMember(address member, uint16 memberSharePct)
    external
    onlyTeamManagerOrController
  {
    require(member != address(0), 'member is required');
    require(memberSharePct <= PercentageMath.ONE, 'invalid share percentage');

    uint256 oldSharePct = getRewardEntry(member).rewardBase;
    uint256 newTotalShare = uint256(_totalShare) + memberSharePct - oldSharePct;
    require(newTotalShare <= PercentageMath.ONE, 'team total share exceeds 100%');
    _totalShare = uint16(newTotalShare);

    (uint256 allocated, uint32 since, bool newcomer) =
      doUpdateReward(
        _teamManager,
        member,
        oldSharePct,
        memberSharePct,
        newTotalShare,
        uint32(block.number)
      );

    require(
      allocated == 0 || isUnlocked(uint32(block.number)),
      'member share can not be changed during lockup'
    );

    if (allocated > 0 || (newcomer && memberSharePct > 0)) {
      IRewardController(getRewardController()).allocatedByPool(member, allocated, since);
    }
    if (memberSharePct == 0) {
      IRewardController(getRewardController()).removedFromPool(member);
    }
  }

  function removeTeamMember(address member) external onlyTeamManagerOrController {
    require(member != address(0), 'member is required');
    uint256 lastShare = internalRemoveReward(member);
    if (lastShare == 0) {
      return;
    }
    if (lastShare < _totalShare) {
      _totalShare -= uint16(lastShare);
    } else {
      _totalShare = 0;
    }
    IRewardController(getRewardController()).removedFromPool(member);
  }

  function setTeamManager(address member) external onlyTeamManagerOrController {
    _teamManager = member;
  }

  function getTeamManager() external view returns (address) {
    return _teamManager;
  }

  function setUnlockBlock(uint32 blockNumber) external onlyTeamManagerOrController {
    require(blockNumber > 0, 'blockNumber is required');
    if (_lockupBlock != 0) {
      require(_lockupBlock > block.number, 'lockup is finished');
    }
    _lockupBlock = blockNumber;
  }

  function getUnlockBlock() external view returns (uint32) {
    return _lockupBlock;
  }
}
