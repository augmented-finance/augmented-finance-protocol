// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardMinter.sol';
import '../access/AccessFlags.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/AccessHelper.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../tools/tokens/ERC20BaseWithPermit.sol';

abstract contract RewardToken is ERC20BaseWithPermit, MarketAccessBitmask, IRewardMinter {
  using AccessHelper for IMarketAccessController;

  uint8 internal constant DECIMALS = 18;
  uint256 internal constant MAX_SUPPLY = (10**8) * (10**DECIMALS);

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

  modifier onlyRewardControllder() virtual {
    _remoteAcl.requireAnyOf(msg.sender, AccessFlags.REWARD_CONTROLLER, Errors.CALLER_NOT_REWARD_CONTROLLER);
    _;
  }

  function mintReward(
    address account,
    uint256 amount,
    bool
  ) external virtual override onlyRewardControllder {
    _mintReward(account, amount);
  }

  function _mintReward(address account, uint256 amount) private {
    _mint(account, amount);
    require(super.totalSupply() <= MAX_SUPPLY, 'MINT_OVER_TOTAL_SUPPLY');
  }

  function _allocateAndMint(address account, uint256 amount) internal {
    require(amount <= uint256(type(int256).max));
    _accTotal += amount;
    _mintReward(account, amount);
    emit RewardAllocated(account, int256(amount));
  }

  function allocateReward(address provider, int256 amount) external override onlyRewardControllder {
    if (amount > 0) {
      _accTotal += uint256(amount);
    } else {
      _accTotal -= uint256(-amount);
    }

    emit RewardAllocated(provider, amount);
  }

  function streamReward(address provider, uint256 ratePerSecond) external override onlyRewardControllder {
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
