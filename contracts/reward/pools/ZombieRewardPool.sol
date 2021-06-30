// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IRewardPool} from '../interfaces/IRewardPool.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';

import 'hardhat/console.sol';

contract ZombieRewardPool is ControlledRewardPool, IRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  struct TokenReward {
    uint256 rateRay;
    uint256 limit;
  }

  mapping(address => TokenReward) private _tokens;
  mapping(address => address) private _providers;

  constructor(
    IRewardController controller,
    address[] memory tokens,
    TokenReward[] memory rewards
  ) public ControlledRewardPool(controller, 0, NO_BASELINE) {
    require(tokens.length == rewards.length, 'inconsistent length');

    for (uint256 i = 0; i < tokens.length; i++) {
      require(tokens[i] != address(0), 'unknown token');
      require(rewards[i].rateRay > 0, 'missing rate');
      _tokens[tokens[i]] = rewards[i];
    }
  }

  function internalGetReward(address) internal override returns (uint256, uint32) {
    return (0, 0);
  }

  function internalCalcReward(address) internal view override returns (uint256, uint32) {
    return (0, 0);
  }

  function addRewardProvider(address provider, address token)
    external
    virtual
    override
    onlyController
  {
    require(provider != address(0), 'provider is required');
    require(_tokens[token].rateRay != 0, 'unknown token');

    address providerToken = _providers[provider];
    if (providerToken == address(0)) {
      _providers[provider] = token;
    } else {
      require(providerToken == token, 'already registered for another token');
    }
  }

  function removeRewardProvider(address provider) external virtual override onlyController {
    delete (_providers[provider]);
  }

  function handleBalanceUpdate(
    address token,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256
  ) external override {
    allocateReward(
      token,
      holder,
      newBalance.sub(oldBalance, 'balance reduction is not allowed by the reward pool')
    );
  }

  function handleScaledBalanceUpdate(
    address token,
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256,
    uint256 scaleRay
  ) external override {
    allocateReward(
      token,
      holder,
      newBalance.sub(oldBalance, 'balance reduction is not allowed by the reward pool').rayMul(
        scaleRay
      )
    );
  }

  function allocateReward(
    address token,
    address holder,
    uint256 allocated
  ) private notPaused {
    require(token != address(0), 'unknown token');
    require(_providers[msg.sender] == token, 'unknown provider or restricted token');

    TokenReward storage tr = _tokens[token];

    allocated = allocated.rayMul(tr.rateRay);
    tr.limit = tr.limit.sub(allocated, 'insufficient reward pool balance');

    _controller.allocatedByPool(holder, allocated, uint32(block.timestamp), AllocationMode.Push);
  }

  function isScaledBalanceUpdateNeeded() external view override returns (bool) {
    // scaling is important to match different providers
    return true;
  }

  function internalSetBaselinePercentage(uint16) internal override {
    revert('NOT_SUPPORTED');
  }

  function internalSetRate(uint256) internal override {}

  function internalGetRate() internal view override returns (uint256) {
    return 0;
  }
}
