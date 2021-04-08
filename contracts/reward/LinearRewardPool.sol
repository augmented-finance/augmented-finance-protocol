// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {Aclable} from '../misc/Aclable.sol';
import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

contract LinearRewardPool is Aclable, IRewardPool, IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 aclRewardProvider = 1 << 1;

  IRewardController private _controller;

  uint256 private _accumRate;
  uint256 private _blockRate; // rays, linear
  uint32 private _lastUpdateBlock;

  mapping(address => RewardEntry) private _rewards;

  constructor(IRewardController controller) public {
    _controller = controller;
  }

  function setRate(uint256 rate) external override onlyController {
    internalSetBlockRate(rate, uint32(block.number));
  }

  function claimRewardOnBehalf(address holder) external override onlyController returns (uint256) {
    return internalGetReward(_rewards[holder], uint32(block.number));
  }

  function calcRewardOnBehalf(address holder)
    external
    view
    override
    onlyController
    returns (uint256)
  {
    return internalCalcReward(_rewards[holder], uint32(block.number));
  }

  function addRewardProvider(address provider) external override onlyController {
    _grantAcl(provider, aclRewardProvider);
  }

  function removeRewardProvider(address provider) external override onlyController {
    _revokeAllAcl(provider);
  }

  function handleAction(
    address holder,
    uint256 newRewardBase,
    uint256 totalSupply
  ) external override aclHas(aclRewardProvider) {
    totalSupply;
    holder;
    newRewardBase;
    require(false, 'not implemented: handleAction');
  }

  function handleBalanceUpdate(
    address holder,
    uint256 newRewardBase,
    uint256 totalSupply
  ) external override aclHas(aclRewardProvider) {
    totalSupply;
    uint256 allocated = internalUpdateReward(_rewards[holder], newRewardBase, uint32(block.number));
    if (allocated > 0) {
      _controller.allocatedByPool(holder, allocated);
    }
    if (newRewardBase == 0) {
      _controller.removedFromPool(holder);
    }
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
    _lastUpdateBlock = currentBlock;
  }

  struct RewardEntry {
    uint256 rewardBase;
    uint256 lastAccumRate;
  }

  function internalGetReward(RewardEntry storage entry, uint32 currentBlock)
    private
    returns (uint256 allocated)
  {
    if (entry.rewardBase == 0) {
      return 0;
    }

    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    allocated = entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate));
    entry.lastAccumRate = adjRate;
    return allocated;
  }

  function internalUpdateReward(
    RewardEntry storage entry,
    uint256 rewardBase,
    uint32 currentBlock
  ) private returns (uint256 allocated) {
    uint256 adjRate = _accumRate.add(_blockRate.mul(currentBlock - _lastUpdateBlock));
    if (entry.rewardBase != 0) {
      allocated = entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate));
    }
    entry.lastAccumRate = adjRate;
    entry.rewardBase = rewardBase;
    return allocated;
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
    return entry.rewardBase.rayMul(adjRate.sub(entry.lastAccumRate));
  }

  modifier onlyController() {
    require(msg.sender == address(_controller), 'only controller is allowed');
    _;
  }
}
