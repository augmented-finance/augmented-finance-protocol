// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../../access/AccessBitmask.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract ControlledRewardPool is IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  IRewardController internal _controller;

  constructor(IRewardController controller) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
  }

  function getRewardController() public view returns (address) {
    return address(_controller);
  }

  function claimRewardFor(address holder)
    external
    override
    onlyController
    returns (uint256, uint32)
  {
    return internalGetReward(holder, uint32(block.number));
  }

  function calcRewardFor(address holder) external view override returns (uint256, uint32) {
    return internalCalcReward(holder, uint32(block.number));
  }

  function internalAllocateReward(
    address holder,
    uint256 allocated,
    uint32 since,
    bool newcomer,
    uint256 newBalance
  ) internal {
    if (allocated > 0 || (newcomer && isLazy())) {
      _controller.allocatedByPool(holder, allocated, since);
    }
    if (newBalance == 0 && !newcomer) {
      _controller.removedFromPool(holder);
    }
  }

  function isLazy() public view virtual override returns (bool);

  function internalGetReward(address holder, uint32 currentBlock)
    internal
    virtual
    returns (uint256, uint32);

  function internalCalcReward(address holder, uint32 currentBlock)
    internal
    view
    virtual
    returns (uint256, uint32);

  function isController(address addr) internal view returns (bool) {
    return address(_controller) == addr;
  }

  modifier onlyController() {
    require(isController(msg.sender), 'only controller is allowed');
    _;
  }

  modifier onlyRateController() {
    require(_controller.isRateController(msg.sender), 'only rate controller is allowed');
    _;
  }
}
