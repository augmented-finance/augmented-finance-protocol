// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';

contract RewardConfigurator is VersionedInitializable {
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  //   function addRewardPool(IManagedRewardPool pool) external onlyOwner {
  //     require(address(pool) != address(0), 'reward pool required');
  //     require(_poolMask[address(pool)] == 0, 'already registered');
  //     pool.claimRewardFor(address(this)); // access check
  //     require(_poolList.length <= 255, 'too many pools');

  //     _poolMask[address(pool)] = 1 << _poolList.length;
  //     if (!pool.isLazy()) {
  //       _ignoreMask |= 1 << _poolList.length;
  //     }
  //     _poolList.push(pool);
  //   }

  //   function removeRewardPool(IManagedRewardPool pool) external onlyOwner {
  //     require(address(pool) != address(0), 'reward pool required');
  //     uint256 mask = _poolMask[address(pool)];
  //     if (mask == 0) {
  //       return;
  //     }
  //     delete (_poolMask[address(pool)]);
  //     _ignoreMask |= mask;
  //   }

  //   function addRewardProvider(
  //     address pool,
  //     address provider,
  //     address token
  //   ) external onlyOwner {
  //     IManagedRewardPool(pool).addRewardProvider(provider, token);
  //   }

  //   function removeRewardProvider(address pool, address provider) external onlyOwner {
  //     IManagedRewardPool(pool).removeRewardProvider(provider);
  //   }

  //   function updateBaseline(uint256 baseline) external onlyOwner {
  //     for (uint256 i = 0; i < _poolList.length; i++) {
  //       _poolList[i].updateBaseline(baseline);
  //     }
  //   }

  //   function setPoolRate(address pool, uint256 rate) external onlyOwner {
  //     IManagedRewardPool(pool).setRate(rate);
  //   }

  //   function setRewardMinter(IRewardMinter minter) external onlyOwner {
  //     _rewardMinter = minter;
  //   }
}
