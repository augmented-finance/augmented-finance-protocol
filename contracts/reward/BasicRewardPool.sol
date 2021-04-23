// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';
// import {AccessBitmask} from '../access/AccessBitmask.sol';
import {IRewardController} from './interfaces/IRewardController.sol';
import {IRewardPool, IManagedRewardPool} from './interfaces/IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BasicRewardPool is IRewardPool, IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint16 private constant NO_BASELINE = type(uint16).max;

  IRewardController private _controller;
  uint256 private _rate;
  uint32 private _lastUpdateBlock;
  uint16 private _baselinePercentage;

  mapping(address => uint256) private _providers;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage
  ) public {
    require(address(controller) != address(0), 'controller is required');
    _controller = controller;
    _rate = initialRate;
    if (_rate != 0 && baselinePercentage == 0) {
      _baselinePercentage = NO_BASELINE;
    } else {
      _baselinePercentage = baselinePercentage;
    }
    _lastUpdateBlock = uint32(block.number);
  }

  function updateBaseline(uint256 baseline) external override onlyController {
    if (_baselinePercentage == NO_BASELINE) {
      return;
    }
    setRate(baseline.percentMul(_baselinePercentage));
  }

  function disableBaseline() external override onlyController {
    _baselinePercentage = NO_BASELINE;
  }

  function setBaselinePercentage(uint16 factor) external override onlyRateController {
    require(factor <= PercentageMath.ONE, 'illegal value');
    _baselinePercentage = factor;
  }

  function setRate(uint256 rate) public override onlyRateController {
    uint32 currentBlock = uint32(block.number);
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

  function getRate() public view returns (uint256) {
    return _rate;
  }

  function getRewardController() public view returns (address) {
    return address(_controller);
  }

  function internalGetLastUpdateBlock() internal view returns (uint32) {
    return _lastUpdateBlock;
  }

  function claimRewardFor(address holder) external override onlyController returns (uint256) {
    return internalGetReward(holder, uint32(block.number));
  }

  function calcRewardFor(address holder) external view override returns (uint256) {
    return internalCalcReward(holder, uint32(block.number));
  }

  function addRewardProvider(address provider) external virtual override onlyController {
    require(provider != address(0), 'provider is required');
    uint256 providerBalance = _providers[provider];
    if (providerBalance > 0) {
      return;
    }
    _providers[provider] = 1;
    internalUpdateTotalSupply(provider, 0, 1, uint32(block.number));
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    uint256 providerBalance = _providers[provider];
    if (providerBalance == 0) {
      return;
    }
    internalUpdateTotalSupply(provider, providerBalance, 0, uint32(block.number));
    delete (_providers[provider]);
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply
  ) external override {
    uint256 providerBalance = _providers[msg.sender];
    require(providerBalance > 0, 'unknown reward provider');
    if (totalSupply == 0) {
      totalSupply = 1;
    }
    internalUpdateTotalSupply(msg.sender, providerBalance, totalSupply, uint32(block.number));

    internalBalanceUpdate(holder, oldBalance, newBalance, totalSupply);
  }

  function internalBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 totalSupply
  ) internal {
    (uint256 allocated, bool newcomer) =
      internalUpdateReward(holder, oldBalance, newBalance, totalSupply, uint32(block.number));

    if (allocated > 0 || (newcomer && isLazy())) {
      _controller.allocatedByPool(holder, allocated);
    }
    if (newBalance == 0 && !newcomer) {
      _controller.removedFromPool(holder);
    }
  }

  function isLazy() public view virtual override returns (bool);

  function internalSetProviderBalance(address provider, uint256 providerBalance) internal {
    // require(_providers[provider] > 0, 'unknown reward provider');
    if (providerBalance == 0) {
      providerBalance = 1;
    }
    _providers[provider] = providerBalance;
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
