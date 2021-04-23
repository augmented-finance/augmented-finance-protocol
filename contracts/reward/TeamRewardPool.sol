// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';
import {IRewardController} from './interfaces/IRewardController.sol';
import {AccumulatingRewardPool} from './AccumulatingRewardPool.sol';

import 'hardhat/console.sol';

contract TeamRewardPool is AccumulatingRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
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
  ) public AccumulatingRewardPool(controller, initialRate, baselinePercentage) {}

  modifier onlyTeamManagerOrController() {
    require(
      msg.sender == _teamManager || isController(msg.sender),
      'only team manager or controller'
    );
    _;
  }

  function internalUpdateTotalSupply(
    address,
    uint256,
    uint256,
    uint32
  ) internal override {}

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual override {
    _accumRate = _accumRate.add(lastRate.mul(currentBlock - lastBlock));
    super.internalRateUpdated(lastRate, lastBlock, currentBlock);
  }

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    override
    returns (uint256)
  {
    if (!isUnlocked(currentBlock)) {
      return 0;
    }
    return super.internalGetReward(holder, currentBlock);
  }

  function internalCalcRateAndReward(RewardEntry memory entry, uint32 currentBlock)
    internal
    view
    override
    returns (uint256 rate, uint256 allocated)
  {
    uint256 adjRate = _accumRate.add(getRate().mul(currentBlock - internalGetLastUpdateBlock()));
    allocated = entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate)).div(PercentageMath.ONE);

    return (adjRate, allocated);
  }

  function addRewardProvider(address) external override {
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

    uint256 newTotalShare = uint256(_totalShare) + memberSharePct;
    require(newTotalShare <= PercentageMath.ONE, 'team total share exceeds 100%');
    _totalShare = uint16(newTotalShare);

    (uint256 allocated, bool newcomer) =
      internalUpdateReward(member, 0, memberSharePct, 0, uint32(block.number));
    require(
      allocated == 0 || isUnlocked(uint32(block.number)),
      'member share can not be changed during lockup'
    );
    if (allocated > 0 || newcomer) {
      IRewardController(getRewardController()).allocatedByPool(member, allocated);
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
