// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardMinter.sol';
import '../access/AccessFlags.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../tools/tokens/ERC20BaseWithPermit.sol';

abstract contract RewardToken is ERC20BaseWithPermit, MarketAccessBitmask, IRewardMinter {
  uint256 internal constant MAX_SUPPLY = 10**8;

  uint256 private _accTotal;
  uint224 private _lastRate;
  uint32 private _lastRateAt;

  function totalSupply() public pure override returns (uint256) {
    return MAX_SUPPLY;
  }

  function mintedSupply() public view override returns (uint256) {
    return super.totalSupply();
  }

  function allocatedSupply() public view override returns (uint256 allocated) {
    return _accTotal + (block.timestamp - _lastRateAt) * _lastRate;
  }

  function mintReward(address account, uint256 amount)
    external
    virtual
    override
    aclAnyOf(AccessFlags.REWARD_CONTROLLER)
  {
    _mint(account, amount);
    require(super.totalSupply() <= MAX_SUPPLY, 'MINT_OVER_TOTAL_SUPPLY');
  }

  function allocateReward(address provider, uint256 amount) external override aclAnyOf(AccessFlags.REWARD_CONTROLLER) {
    _accTotal += amount;

    emit RewardAllocated(provider, amount);
  }

  function streamReward(address provider, uint256 ratePerSecond)
    external
    override
    aclAnyOf(AccessFlags.REWARD_CONTROLLER)
  {
    if (_lastRate == ratePerSecond) {
      return;
    }
    require(ratePerSecond <= type(uint224).max, 'RATE_TOO_HIGH');
    _accTotal = allocatedSupply();
    _lastRateAt = uint32(block.timestamp);
    _lastRate = uint224(ratePerSecond);

    emit RewardMaxRateUpdated(provider, ratePerSecond);
  }
}
