// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';

import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {MarketAccessBitmask} from '../access/MarketAccessBitmask.sol';
import {Errors} from '../tools/Errors.sol';
import {IRewardConfigurator} from './interfaces/IRewardConfigurator.sol';
import {
  IManagedRewardController,
  IUntypedRewardControllerPools,
  IManagedRewardBooster
} from './interfaces/IRewardController.sol';
import {IManagedRewardPool} from './interfaces/IManagedRewardPool.sol';
import {IInitializableRewardToken} from './interfaces/IInitializableRewardToken.sol';
import {IInitializableRewardPool} from './interfaces/IInitializableRewardPool.sol';
import {ProxyOwner} from '../tools/upgradeability/ProxyOwner.sol';
import {IRewardedToken} from '../interfaces/IRewardedToken.sol';

contract RewardConfigurator is
  MarketAccessBitmask(IMarketAccessController(0)),
  VersionedInitializable,
  IRewardConfigurator
{
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  ProxyOwner internal immutable _proxies;

  constructor() public {
    _proxies = new ProxyOwner();
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
  }

  function getDefaultController() public view returns (IManagedRewardController) {
    address ctl = _remoteAcl.getRewardController();
    require(ctl != address(0), 'incomplete configuration');
    return IManagedRewardController(ctl);
  }

  function updateBaseline(uint256 baseline) external onlyRewardAdmin {
    getDefaultController().updateBaseline(baseline);
  }

  function list() public view returns (address[] memory pools) {
    uint256 ignoreMask;
    (pools, ignoreMask) = IUntypedRewardControllerPools(address(getDefaultController())).getPools();

    for (uint256 i = 0; ignoreMask > 0 && i < pools.length; i++) {
      if (ignoreMask & 1 != 0) {
        pools[i] = address(0);
      }
      ignoreMask >>= 1;
    }
    return pools;
  }

  function batchInitRewardPools(PoolInitData[] calldata entries) external onlyRewardAdmin {
    IManagedRewardController ctl = getDefaultController();

    for (uint256 i = 0; i < entries.length; i++) {
      PoolInitData calldata entry = entries[i];

      IInitializableRewardPool.InitData memory params =
        IInitializableRewardPool.InitData(
          ctl,
          entry.initialRate,
          entry.rateScale,
          entry.baselinePercentage
        );

      address pool =
        address(
          _remoteAcl.createProxy(
            address(_proxies),
            entry.impl,
            abi.encodeWithSelector(IInitializableRewardPool.initialize.selector, params)
          )
        );

      ctl.addRewardPool(IManagedRewardPool(pool));
      if (entry.boostFactor > 0) {
        IManagedRewardBooster(address(ctl)).setBoostFactor(pool, entry.boostFactor);
      }
      IManagedRewardPool(pool).addRewardProvider(entry.provider, entry.provider);
      IRewardedToken(entry.provider).setIncentivesController(pool);

      emit RewardPoolInitialized(pool, entry.provider, entry);
    }
  }

  function implementationOf(address token) external view returns (address) {
    return _proxies.implementationOf(token);
  }

  function updateRewardPool(PoolUpdateData calldata input) external onlyRewardAdmin {
    IInitializableRewardPool.InitData memory params =
      IInitializableRewardPool(input.pool).initializedWith();
    _proxies.upgradeToAndCall(
      input.pool,
      input.impl,
      abi.encodeWithSelector(IInitializableRewardPool.initialize.selector, params)
    );
    emit RewardPoolUpgraded(input.pool, input.impl);
  }

  function buildRewardTokenInitData(
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external view returns (bytes memory) {
    IInitializableRewardToken.InitData memory data =
      IInitializableRewardToken.InitData(_remoteAcl, name, symbol, decimals);
    return abi.encodeWithSelector(IInitializableRewardToken.initialize.selector, data);
  }

  function configureRewardBoost(
    IManagedRewardPool boostPool,
    bool updateRate,
    address excessTarget,
    bool mintExcess
  ) external {
    IManagedRewardBooster booster = IManagedRewardBooster(address(getDefaultController()));

    booster.setUpdateBoostPoolRate(updateRate);
    booster.addRewardPool(boostPool);
    booster.setBoostPool(address(boostPool));
    booster.setBoostExcessTarget(excessTarget, mintExcess);
  }
}
