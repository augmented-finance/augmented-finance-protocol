// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController} from '../interfaces/IRewardController.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';

import 'hardhat/console.sol';

contract ZombieRewardPool is ControlledRewardPool {
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
  ) public ControlledRewardPool(controller) {
    require(address(controller) != address(0), 'controller is required');
    require(tokens.length == rewards.length, 'inconsistent length');

    _controller = controller;
    for (uint256 i = 0; i < tokens.length; i++) {
      require(tokens[i] != address(0), 'unknown token');
      require(rewards[i].rateRay > 0, 'missing rate');
      _tokens[tokens[i]] = rewards[i];
    }
  }

  function updateBaseline(uint256 baseline) external override onlyController {}

  function disableBaseline() external override onlyController {}

  function setBaselinePercentage(uint16) external override onlyRateController {
    revert('UNSUPPORTED');
  }

  function setRate(uint256) public override onlyRateController {
    revert('UNSUPPORTED');
  }

  function internalGetReward(address, uint32) internal override returns (uint256, uint32) {
    return (0, 0);
  }

  function internalCalcReward(address, uint32) internal view override returns (uint256, uint32) {
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
    require(token != address(0), 'unknown token');
    require(_providers[msg.sender] == token, 'unknown provider or restriced token');
    require(newBalance >= oldBalance, 'balance reduction is not allowed by the reward pool');

    TokenReward storage tr = _tokens[token];

    uint256 allocated = uint256(newBalance - oldBalance).rayMul(tr.rateRay);
    require(tr.limit >= allocated, 'insufficient reward pool balance');
    tr.limit -= allocated;

    _controller.allocatedByPool(holder, allocated, uint32(block.number));
  }

  function isLazy() public view virtual override returns (bool) {
    return false;
  }
}
