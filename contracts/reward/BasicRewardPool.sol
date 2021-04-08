// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {Aclable} from '../misc/Aclable.sol';
import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardPool is Aclable, IRewardPool, IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 constant aclConfigure = 1 << 1;
  uint256 constant aclRewardProvider = 1 << 2;

  IRewardController private _controller;
  uint256 private _rate;

  constructor(IRewardController controller) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
    _grantAcl(msg.sender, aclConfigure);
    _grantAcl(address(controller), aclConfigure);
  }

  function setRate(uint256 rate) external override aclHas(aclConfigure) {
    _rate = rate;
  }

  function claimRewardOnBehalf(address holder) external override onlyController returns (uint256) {
    return internalGetReward(holder, uint32(block.number));
  }

  function calcRewardOnBehalf(address holder)
    external
    view
    override
    onlyController
    returns (uint256)
  {
    return internalCalcReward(holder, uint32(block.number));
  }

  function addRewardProvider(address provider) external override onlyController {
    _grantAcl(provider, aclRewardProvider);
  }

  function removeRewardProvider(address provider) external override onlyController {
    _revokeAcl(provider, aclRewardProvider);
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
    uint256 allocated = internalUpdateReward(holder, newRewardBase, uint32(block.number));
    if (allocated > 0) {
      _controller.allocatedByPool(holder, allocated);
    }
    if (newRewardBase == 0) {
      _controller.removedFromPool(holder);
    }
  }

  function internalUpdateReward(
    address holder,
    uint256 rewardBase,
    uint32 currentBlock
  ) internal virtual returns (uint256);

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    virtual
    returns (uint256);

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    virtual
    returns (uint256);

  modifier onlyController() {
    require(msg.sender == address(_controller), 'only controller is allowed');
    _;
  }
}
