// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';
import {MarketAccessBitmask} from '../access/MarketAccessBitmask.sol';
import {Errors} from '../tools/Errors.sol';
import {IRewardConfigurator} from './interfaces/IRewardConfigurator.sol';
import {IManagedRewardController} from './interfaces/IRewardController.sol';
import {IManagedRewardPool} from './interfaces/IManagedRewardPool.sol';
import {IMigratorHook} from '../interfaces/IMigratorHook.sol';
import {IRewardMinter} from '../interfaces/IRewardMinter.sol';

contract RewardConfigurator is
  MarketAccessBitmask(IMarketAccessController(0)),
  VersionedInitializable,
  IRewardConfigurator,
  IMigratorHook
{
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  // TODO mapping for pool implementations

  address internal _migrator;

  struct NamedPool {
    IManagedRewardPool pool;
    string[] names;
  }

  mapping(uint256 => NamedPool) internal _rewardPools;
  mapping(address => uint256) internal _poolToPoolNum;
  mapping(string => uint256) internal _nameToPoolNum;
  uint256 internal _rewardPoolCount;

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
  }

  function setMigrator(address migrator) external onlyRewardAdmin {
    _migrator = migrator;
  }

  function handleTokenMigrated(address token, address[] memory rewardPools) external override {
    require(msg.sender == _migrator, 'NOT_MIGRATOR');

    token;
    for (uint256 i = 0; i < rewardPools.length; i++) {
      address pool = rewardPools[i];
      if (pool == address(0)) {
        continue;
      }
      IManagedRewardPool(pool).disableRewardPool();
    }
  }

  function updateBaselineOf(IManagedRewardController ctl, uint256 baseline)
    external
    onlyRewardAdmin
  {
    ctl.updateBaseline(baseline);
  }

  function getDefaultController() public view returns (IManagedRewardController) {
    address ctl = _remoteAcl.getRewardController();
    require(ctl != address(0), 'incomplete configuration');
    return IManagedRewardController(ctl);
  }

  function updateBaseline(uint256 baseline) external onlyRewardAdmin {
    getDefaultController().updateBaseline(baseline);
  }

  function addRewardPool(IManagedRewardPool pool, string memory name) public onlyRewardAdmin {
    require(pool != IManagedRewardPool(0), 'pool is required');
    require(_nameToPoolNum[name] == 0, 'duplicate pool name');

    uint256 poolNum = _poolToPoolNum[address(pool)];
    if (poolNum == 0) {
      poolNum = _rewardPoolCount + 1;
      _rewardPoolCount = poolNum;
      _rewardPools[poolNum].pool = pool;
      _poolToPoolNum[address(pool)] = poolNum;
    }
    _rewardPools[poolNum].names.push(name);
    _nameToPoolNum[name] = poolNum;

    IManagedRewardController(pool.getRewardController()).addRewardPool(pool);
  }

  function removeRewardPool(IManagedRewardPool pool) external onlyRewardAdmin returns (bool) {
    uint256 poolNum = _poolToPoolNum[address(pool)];
    if (poolNum == 0) {
      return false;
    }

    string[] memory names = _rewardPools[poolNum].names;
    for (uint256 i = 0; i < names.length; i++) {
      delete (_nameToPoolNum[names[i]]);
    }
    delete (_poolToPoolNum[address(pool)]);
    delete (_rewardPools[poolNum]);
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

  function findRewardPoolByName(string memory name) public view returns (address) {
    uint256 poolNum = _nameToPoolNum[name];
    if (poolNum == 0) {
      return address(0);
    }
    return address(_rewardPools[poolNum].pool);
  }

  // function overridePoolRate(address pool, uint256 rate) external onlyOwner {
  //   IManagedRewardPool(pool).setRate(rate);
  // }

  // function batchInitStakeTokens(StakeInitData[] memory input) public onlyRewardAdmin {
  //   for (uint256 i = 0; i < input.length; i++) {
  //     initStakeToken(input[i]);
  //   }
  // }

  // function initStakeToken(StakeInitData memory input) private returns (address) {
  //   StakeTokenConfig memory config =
  //     StakeTokenConfig(
  //       _remoteAcl,
  //       IERC20(input.stakedToken),
  //       input.cooldownPeriod,
  //       input.unstakeBlocks,
  //       ITransferHook(0)
  //     );

  //   bytes memory params =
  //     abi.encodeWithSelector(
  //       IInitializableStakeToken.initialize.selector,
  //       config,
  //       input.stkTokenName,
  //       input.stkTokenSymbol,
  //       input.stkTokenDecimals
  //     );

  //   return address(_remoteAcl.createProxy(address(this), input.stakeTokenImpl, params));
  // }
}
