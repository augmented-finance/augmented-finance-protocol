// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/upgradeability/VersionedInitializable.sol';

import '../access/interfaces/IMarketAccessController.sol';
import '../access/MarketAccessBitmask.sol';
import '../tools/Errors.sol';
import './interfaces/IRewardConfigurator.sol';
import './interfaces/IRewardController.sol';
import './interfaces/IManagedRewardController.sol';
import './interfaces/IManagedRewardPool.sol';
import './interfaces/IInitializableRewardToken.sol';
import './interfaces/IInitializableRewardPool.sol';
import '../tools/upgradeability/ProxyAdmin.sol';
import '../interfaces/IRewardedToken.sol';
import './pools/TeamRewardPool.sol';
import '../tools/upgradeability/IProxy.sol';

contract RewardConfigurator is
  MarketAccessBitmask(IMarketAccessController(address(0))),
  VersionedInitializable,
  IRewardConfigurator
{
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  ProxyAdmin internal immutable _proxies;
  mapping(string => address) _namedPools;

  constructor() {
    _proxies = new ProxyAdmin();
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
  }

  function getDefaultController() public view returns (IManagedRewardController) {
    address ctl = _remoteAcl.getAddress(AccessFlags.REWARD_CONTROLLER);
    require(ctl != address(0), 'incomplete configuration');
    return IManagedRewardController(ctl);
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
        IInitializableRewardPool.InitData(ctl, entry.poolName, entry.baselinePercentage);

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
      if (entry.provider != address(0)) {
        IManagedRewardPool(pool).addRewardProvider(entry.provider, entry.provider);
        IRewardedToken(entry.provider).setIncentivesController(pool);
      }

      emit RewardPoolInitialized(pool, entry.provider, entry);
    }
  }

  function addNamedRewardPools(
    IManagedRewardPool[] calldata pools,
    string[] calldata names,
    uint32[] calldata boostFactors
  ) external onlyRewardAdmin {
    require(pools.length >= names.length);
    require(pools.length >= boostFactors.length);

    IManagedRewardController ctl = getDefaultController();

    for (uint256 i = 0; i < names.length; i++) {
      IManagedRewardPool pool = pools[i];
      if (pool != IManagedRewardPool(address(0))) {
        ctl.addRewardPool(pool);
      }
      if (i < names.length && bytes(names[i]).length > 0) {
        _namedPools[names[i]] = address(pool);
      }
      if (i < boostFactors.length && boostFactors[i] > 0) {
        IManagedRewardBooster(address(ctl)).setBoostFactor(address(pool), boostFactors[i]);
      }
    }
  }

  function getNamedRewardPools(string[] calldata names)
    external
    view
    returns (address[] memory pools)
  {
    pools = new address[](names.length);
    for (uint256 i = 0; i < names.length; i++) {
      pools[i] = _namedPools[names[i]];
    }
    return pools;
  }

  function implementationOf(address token) external view returns (address) {
    return _proxies.getProxyImplementation(IProxy(token));
  }

  function updateRewardPool(PoolUpdateData calldata input) external onlyRewardAdmin {
    IInitializableRewardPool.InitData memory params =
      IInitializableRewardPool(input.pool).initializedWith();
    _proxies.upgradeAndCall(
      IProxy(input.pool),
      input.impl,
      abi.encodeWithSelector(IInitializableRewardPool.initialize.selector, params)
    );
    emit RewardPoolUpgraded(input.pool, input.impl);
  }

  function buildRewardPoolInitData(string calldata poolName, uint16 baselinePercentage)
    external
    view
    returns (bytes memory)
  {
    IInitializableRewardPool.InitData memory data =
      IInitializableRewardPool.InitData(getDefaultController(), poolName, baselinePercentage);
    return abi.encodeWithSelector(IInitializableRewardPool.initialize.selector, data);
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
  ) external onlyRewardAdmin {
    IManagedRewardBooster booster = IManagedRewardBooster(address(getDefaultController()));

    booster.setUpdateBoostPoolRate(updateRate);
    booster.addRewardPool(boostPool);
    booster.setBoostPool(address(boostPool));
    booster.setBoostExcessTarget(excessTarget, mintExcess);
  }

  function configureTeamRewardPool(
    TeamRewardPool pool,
    string calldata name,
    uint32 unlockedAt,
    address[] calldata members,
    uint16[] calldata memberShares
  ) external onlyRewardAdmin {
    IManagedRewardController ctl = getDefaultController();
    ctl.addRewardPool(pool);
    _namedPools[name] = address(pool);

    if (unlockedAt > 0) {
      pool.setUnlockedAt(unlockedAt);
    }
    if (members.length > 0) {
      pool.updateTeamMembers(members, memberShares);
    }
  }

  function setBaselinePercentages(IManagedRewardPool[] calldata pools, uint16[] calldata pcts)
    external
    onlyRewardRateAdmin
  {
    require(pools.length == pcts.length);

    for (uint256 i = 0; i < pools.length; i++) {
      pools[i].setBaselinePercentage(pcts[i]);
    }
  }

  function getPoolTotals(bool excludeBoost)
    external
    view
    returns (
      uint256 totalBaselinePercentage,
      uint256 totalRate,
      uint256 activePoolCount,
      uint256 poolCount,
      uint256 listCount
    )
  {
    IManagedRewardController ctl = getDefaultController();
    (IManagedRewardPool[] memory pools, uint256 ignoreMask) = ctl.getPools();

    listCount = pools.length;

    if (excludeBoost) {
      (, uint256 mask) = IManagedRewardBooster(address(ctl)).getBoostPool();
      if (mask != 0) {
        poolCount++;
        ignoreMask |= mask;
      }
    }

    for (uint256 i = 0; i < pools.length; i++) {
      if (ignoreMask & 1 == 0 && pools[i] != IManagedRewardPool(address(0))) {
        activePoolCount++;
        (bool ok, uint16 pct) = pools[i].getBaselinePercentage();
        if (ok) {
          totalBaselinePercentage += uint256(pct);
        }
        totalRate += pools[i].getRate();
      }
      ignoreMask >>= 1;
    }
    poolCount += activePoolCount;
  }
}
