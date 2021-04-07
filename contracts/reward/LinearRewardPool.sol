// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {Aclable} from '../misc/Aclable.sol';
import {IRewardController} from './IRewardController.sol';

import 'hardhat/console.sol';

contract LinearRewardPool is Aclable {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 aclRewardProvider = 1 << 1;

  IRewardController private _controller;
  uint256 private _poolMask;

  uint256 private _accumRate;
  uint256 private _blockRate; // rays, linear
  uint32 private _lastUpdateBlock;

  mapping(address => RewardEntry) private _rewards;

  constructor(IRewardController controller) public {
    _controller = controller;
  }

  function setPoolMask(uint256 mask) external onlyController {
    require(mask != 0 && mask & (mask - 1) == 0, 'mask can only have one bit');
    _poolMask = mask;
  }

  function setBlockRate(uint256 blockRate) external onlyController {
    internalSetBlockRate(blockRate, uint32(block.number));
  }

  function claimRewardOnBehalf(address holder) external onlyController returns (uint256) {
    return internalGetReward(_rewards[holder], uint32(block.number));
  }

  function calcRewardOnBehalf(address holder) external view onlyController returns (uint256) {
    return internalCalcReward(_rewards[holder], uint32(block.number));
  }

  function addRewardProvider(address provider) external onlyController {
    _grantAcl(provider, aclRewardProvider);
  }

  function removeRewardProvider(address provider) external onlyController {
    _revokeAllAcl(provider);
  }

  function updateRewardOnBehalf(address holder, uint256 newRewardBase)
    external
    aclHas(aclRewardProvider)
  {
    internalUpdateReward(_rewards[holder], newRewardBase, uint32(block.number));
  }

  function internalSetBlockRate(uint256 blockRate, uint32 currentBlock) internal {
    require(currentBlock > 0, 'non-zero current block is required');
    require(currentBlock >= _lastUpdateBlock, 'retroactive update');

    if (_lastUpdateBlock == 0) {
      if (blockRate == 0) {
        return;
      }
      _blockRate = blockRate;
      _lastUpdateBlock = currentBlock;
      return;
    }
    if (_blockRate == blockRate) {
      return;
    }
    if (_lastUpdateBlock == currentBlock) {
      _blockRate = blockRate;
      return;
    }
    _accumRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
  }

  struct RewardEntry {
    uint256 rewardBase;
    uint256 lastAccumRate;
    uint256 allocatedReward;
  }

  function internalGetReward(RewardEntry storage entry, uint32 currentBlock)
    private
    returns (uint256 allocated)
  {
    if (entry.rewardBase == 0) {
      if (entry.allocatedReward > 0) {
        allocated = entry.allocatedReward;
        entry.allocatedReward = 0;
      }
      return allocated;
    }

    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    allocated = entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate));
    entry.lastAccumRate = adjRate;

    if (entry.allocatedReward > 0) {
      allocated = allocated.add(entry.allocatedReward);
      entry.allocatedReward = 0;
    }
    return allocated;
  }

  function internalUpdateReward(
    RewardEntry storage entry,
    uint256 rewardBase,
    uint32 currentBlock
  ) private {
    if (entry.rewardBase == rewardBase) {
      return;
    }
    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    if (entry.rewardBase != 0) {
      entry.allocatedReward = entry.allocatedReward.add(
        entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate))
      );
    }

    entry.lastAccumRate = adjRate;
    entry.rewardBase = rewardBase;
  }

  function internalCalcReward(RewardEntry storage entry, uint32 currentBlock)
    private
    view
    returns (uint256)
  {
    if (entry.rewardBase == 0) {
      return 0;
    }
    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    return entry.allocatedReward.add(entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate)));
  }

  modifier onlyController() {
    require(msg.sender == address(_controller), 'only controller is allowed');
    _;
  }
}
