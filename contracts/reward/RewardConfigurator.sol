// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {Errors} from '../tools/Errors.sol';
import {
  InitializableImmutableAdminUpgradeabilityProxy
} from '../tools/upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';
import {IRewardConfigurator} from './interfaces/IRewardConfigurator.sol';
import {IRewardController} from './interfaces/IRewardController.sol';
import {IManagedRewardPool} from './interfaces/IRewardPool.sol';
import {IMigratorHook} from '../interfaces/IMigratorHook.sol';

contract RewardConfigurator is VersionedInitializable, IRewardConfigurator, IMigratorHook {
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  IMarketAccessController internal _addressesProvider;
  address internal _migrator;

  mapping(uint256 => address) internal _rewardPools;
  uint256 internal _rewardPoolCount;

  modifier onlyRewardAdmin {
    require(_addressesProvider.isRewardAdmin(msg.sender), Errors.CALLER_NOT_REWARD_ADMIN);
    _;
  }

  modifier onlyEmergencyAdmin {
    require(_addressesProvider.isEmergencyAdmin(msg.sender), Errors.LPC_CALLER_NOT_EMERGENCY_ADMIN);
    _;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider)
    external
    initializerRunAlways(CONFIGURATOR_REVISION)
  {
    _addressesProvider = IMarketAccessController(addressesProvider);
  }

  function handleTokenMigrated(address token, address[] memory rewardPools) external override {
    require(msg.sender == _migrator, 'NOT_MIGRATOR');

    token;
    for (uint256 i = 0; i < rewardPools.length; i++) {
      address pool = rewardPools[i];
      if (pool == address(0)) {
        continue;
      }
      IManagedRewardPool(pool).disableBaseline();
      IManagedRewardPool(pool).setRate(0);
    }
  }

  //   function updateBaseline(uint256 baseline) external onlyRewardAdmin {
  //     baseline;
  //   }

  //   function getRewardPool(string memory name) public {

  //   }

  //   function getMigrationRewardPool(string memory name) public {

  //   }

  //     struct InitReserveInput{
  //         uint256 a;
  //     }

  //   function batchInitPools(InitReserveInput[] calldata input) external onlyRewardAdmin {
  //     // for (uint256 i = 0; i < input.length; i++) {
  //     //   _initReserve(cachedPool, input[i]);
  //     // }
  //   }

  //   function _initTokenWithProxy(address implementation, bytes memory initParams)
  //     internal
  //     returns (address)
  //   {
  //     InitializableImmutableAdminUpgradeabilityProxy proxy =
  //       new InitializableImmutableAdminUpgradeabilityProxy(address(this));

  //     proxy.initialize(implementation, initParams);

  //     return address(proxy);
  //   }

  //   function _upgradeTokenImplementation(
  //     address proxyAddress,
  //     address implementation,
  //     bytes memory initParams
  //   ) internal {
  //     InitializableImmutableAdminUpgradeabilityProxy proxy =
  //       InitializableImmutableAdminUpgradeabilityProxy(payable(proxyAddress));

  //     proxy.upgradeToAndCall(implementation, initParams);
  //   }

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
