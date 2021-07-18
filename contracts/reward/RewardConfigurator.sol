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
  IUntypedRewardControllerPools
} from './interfaces/IRewardController.sol';
import {IManagedRewardPool} from './interfaces/IManagedRewardPool.sol';
import {IManagedRewardBooster} from './interfaces/IManagedRewardBooster.sol';

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

  function addRewardPool(IManagedRewardPool pool) public onlyRewardAdmin {
    IManagedRewardController(pool.getRewardController()).addRewardPool(pool);
  }

  function removeRewardPool(IManagedRewardPool pool) external onlyRewardAdmin {
    IManagedRewardController(pool.getRewardController()).removeRewardPool(pool);
  }

  function addRewardProvider(
    IManagedRewardPool pool,
    address provider,
    address token
  ) external onlyRewardAdmin {
    pool.addRewardProvider(provider, token);
  }

  function removeRewardProvider(IManagedRewardPool pool, address provider)
    external
    onlyRewardAdmin
  {
    pool.removeRewardProvider(provider);
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

  function batchInitRewardPools(PoolInitData[] calldata entries) external override onlyRewardAdmin {
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
      IManagedRewardPool(pool).addRewardProvider(entry.provider, entry.provider);
      IRewardedToken(entry.provider).setIncentivesController(pool);
    }
  }

  function updateRewardToken(PoolUpdateData calldata input) external onlyRewardAdmin {
    // StakeTokenData memory data = dataOf(input.token);
    // bytes memory params =
    //   abi.encodeWithSelector(
    //     IInitializableStakeToken.initialize.selector,
    //     data.config,
    //     input.stkTokenName,
    //     input.stkTokenSymbol,
    //     data.stkTokenDecimals
    //   );
    // _proxies.upgradeToAndCall(input.token, input.stakeTokenImpl, params);
    // emit StakeTokenUpgraded(input.token, input);
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
