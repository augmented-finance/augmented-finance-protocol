// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {AccessBitmask} from '../misc/AccessBitmask.sol';
import {IRewardController} from './IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardPool is AccessBitmask, IRewardPool, IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 constant aclConfigure = 1 << 1;

  IRewardController private _controller;
  uint32 private _cutOffBlock;
  // _lastUpdateBlock must NOT be set past-cutOff
  uint32 private _lastUpdateBlock;
  uint256 private _rate;

  mapping(address => uint256) private _providers;

  constructor(IRewardController controller) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
    _grantAcl(msg.sender, aclConfigure);
    _grantAcl(address(controller), aclConfigure);
  }

  function setRate(uint256 rate) external override aclHas(aclConfigure) {
    uint32 currentBlock = uint32(block.number);
    require(!isCutOff(currentBlock), 'rate cant be set after cut off');

    if (_lastUpdateBlock == 0) {
      if (rate == 0) {
        return;
      }
      _rate = rate;
      _lastUpdateBlock = currentBlock;
      return;
    }
    if (_rate == rate) {
      return;
    }
    if (_lastUpdateBlock == currentBlock) {
      _rate = rate;
      return;
    }
    uint256 prevRate = _rate;
    uint32 prevBlock = _lastUpdateBlock;
    _rate = rate;
    internalRateUpdated(prevRate, prevBlock, currentBlock);
  }

  function internalRateUpdated(
    uint256 lastRate,
    uint32 lastBlock,
    uint32 currentBlock
  ) internal virtual {
    lastRate;
    lastBlock;
    require(currentBlock >= _lastUpdateBlock, 'retroactive update');
    _lastUpdateBlock = currentBlock;
  }

  function getRate() external view returns (uint256) {
    if (isCutOff(uint32(block.number))) {
      return 0;
    }
    return _rate;
  }

  function internalGetRate() internal view returns (uint256) {
    return _rate;
  }

  function internalGetLastUpdateBlock() internal view returns (uint32) {
    return _lastUpdateBlock;
  }

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
    _providers[provider] = 1;
  }

  function removeRewardProvider(address provider) external override aclHas(aclConfigure) {
    uint256 providerInfo = _providers[provider];
    if (providerInfo == 0) {
      return;
    }
    delete (_providers[provider]);
    internalUpdateTotalSupply(provider, providerInfo - 1, 0, uint32(block.number));
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply
  ) external override {
    uint256 providerInfo = _providers[msg.sender];
    require(providerInfo > 0, 'unknown reward provider');
    internalUpdateTotalSupply(msg.sender, providerInfo - 1, totalSupply, uint32(block.number));

    (uint256 allocated, bool newcomer) =
      internalUpdateReward(holder, oldBalance, newBalance, totalSupply, uint32(block.number));
    if (allocated > 0 || (newcomer && !isLazy())) {
      console.log('_controller.allocatedByPool');
      _controller.allocatedByPool(holder, allocated);
    }
    if (newBalance == 0 && !newcomer) {
      _controller.removedFromPool(holder);
    }
  }

  function isLazy() public view virtual override returns (bool);

  function internalSetProviderInfo(address provider, uint256 providerInfo) internal {
    require(_providers[provider] > 0, 'unknown reward provider');
    _providers[provider] = providerInfo.add(1);
  }

  function internalUpdateTotalSupply(
    address provider,
    uint256 providerInfo,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal virtual;

  function internalUpdateReward(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 currentBlock
  ) internal virtual returns (uint256 allocated, bool newcomer);

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
