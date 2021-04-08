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
  uint32 private _cutOffBlock;

  constructor(IRewardController controller) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
    _grantAcl(msg.sender, aclConfigure);
    _grantAcl(address(controller), aclConfigure);
  }

  function setRate(uint256 rate) external override aclHas(aclConfigure) {
    uint32 currentBlock = uint32(block.number);
    require(!isCutOff(currentBlock), 'rate cant be set after cut off');
    internalSetRate(rate, currentBlock);
  }

  function getRate() external view returns (uint256) {
    if (isCutOff(uint32(block.number))) {
      return 0;
    }
    return internalGetRate();
  }

  function internalSetRate(uint256 rate, uint32 currentBlock) internal virtual;

  function internalGetRate() internal view virtual returns (uint256);

  function setCutOff(uint32 blockNumber) external aclHas(aclConfigure) {
    if (blockNumber > 0) {
      require(uint256(blockNumber) > block.number, 'cut off must be in future');
    } else {
      require(uint256(_cutOffBlock) > block.number, 'past cut off cant be cancelled');
    }
    _cutOffBlock = blockNumber;
  }

  function getCutOff() external view returns (uint32 blockNumber) {
    return _cutOffBlock;
  }

  function internalGetCutOff() internal view returns (uint32 blockNumber) {
    return _cutOffBlock;
  }

  function isCutOff(uint32 blockNumber) internal view returns (bool) {
    return _cutOffBlock > 0 && _cutOffBlock < blockNumber;
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

  function addRewardProvider(address provider) external override aclHas(aclConfigure) {
    _grantAcl(provider, aclRewardProvider);
  }

  function removeRewardProvider(address provider) external override aclHas(aclConfigure) {
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
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply
  ) external override aclHas(aclRewardProvider) {
    uint256 allocated =
      internalUpdateReward(holder, oldBalance, newBalance, totalSupply, uint32(block.number));
    if (allocated > 0) {
      _controller.allocatedByPool(holder, allocated);
    }
    if (newBalance == 0) {
      _controller.removedFromPool(holder);
    }
  }

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
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
