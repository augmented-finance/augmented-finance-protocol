// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IMigrationAdapter} from './interfaces/IMigrationAdapter.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {ILendableToken} from './interfaces/ILendableToken.sol';
import {IMigratorHook} from '../interfaces/IMigratorHook.sol';
import {IBalanceHook} from '../interfaces/IBalanceHook.sol';

contract Migrator is Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IMigrationAdapter[] private _adaptersList;
  /* a/c/dToken */
  mapping(address => uint256) private _adapters;
  /* underlying */
  mapping(address => uint256[]) private _underlyings;
  IMigratorHook private _migrateHook;

  function depositToMigrate(
    address token,
    uint256 amount,
    uint64 referralCode
  ) public returns (uint256) {
    return getAdapter(token).depositToMigrate(amount, msg.sender, referralCode);
  }

  function withdrawFromMigrate(address token, uint256 maxAmount) public returns (uint256) {
    return getAdapter(token).withdrawFromMigrateOnBehalf(maxAmount, msg.sender);
  }

  function balanceForMigrate(address token, address holder) public view returns (uint256) {
    return getAdapter(token).balanceForMigrate(holder);
  }

  function claimMigrated(address token) public returns (uint256, bool) {
    return getAdapter(token).claimMigrated(msg.sender);
  }

  function claimAllMigrated()
    public
    returns (uint256 claimedTokenTypes, uint256 notClaimableTokenTypes)
  {
    for (uint256 i = 0; i < _adaptersList.length; i++) {
      if (address(_adaptersList[i]) == address(0)) {
        continue;
      }
      (uint256 claimedAmount, bool claimed) = _adaptersList[i].claimMigrated(msg.sender);
      if (!claimed) {
        notClaimableTokenTypes++;
      } else if (claimedAmount > 0) {
        claimedTokenTypes++;
      }
    }
    return (claimedTokenTypes, notClaimableTokenTypes);
  }

  function getAdapter(address token) public view returns (IMigrationAdapter adapter) {
    uint256 adapterIdx = _adapters[token];
    require(adapterIdx > 0, 'unknown or unsupported token');
    return _adaptersList[adapterIdx - 1];
  }

  function admin_registerAdapter(IMigrationAdapter adapter) public onlyOwner {
    address underlying = adapter.UNDERLYING_ASSET_ADDRESS();
    require(IERC20(underlying).totalSupply() > 0, 'valid underlying is required');

    address origin = adapter.ORIGIN_ASSET_ADDRESS();
    require(IERC20(origin).totalSupply() > 0, 'valid origin is required');

    require(adapter.getController() == address(this), 'adapter is not for this controller');

    require(address(_adapters[origin]) == address(0), 'token is already registered');
    _adaptersList.push(adapter);
    _adapters[origin] = _adaptersList.length;
    _underlyings[underlying].push(_adaptersList.length);
  }

  function admin_unregisterAdapter(IMigrationAdapter adapter) public onlyOwner returns (bool) {
    address origin = adapter.ORIGIN_ASSET_ADDRESS();
    if (_adapters[origin] == 0) {
      return false;
    }
    uint256 idx = _adapters[origin] - 1;
    if (_adaptersList[idx] != adapter) {
      return false;
    }
    delete (_adapters[origin]);
    _adaptersList[idx] = IMigrationAdapter(0);
    return true;
  }

  function admin_unregisterAdapterForToken(address origin) public onlyOwner returns (bool) {
    if (_adapters[origin] == 0) {
      return false;
    }
    uint256 idx = _adapters[origin] - 1;
    if (address(_adaptersList[idx]) == address(0)) {
      return false;
    }
    _adaptersList[idx] = IMigrationAdapter(address(0));
    delete (_adapters[origin]);
    return true;
  }

  function admin_setRewardPool(address adapter, IBalanceHook rewardPool) public onlyOwner {
    IMigrationAdapter(adapter).admin_setRewardPool(rewardPool);
  }

  function admin_migrateToToken(ILendableToken target)
    public
    onlyOwner
    returns (IMigrationAdapter[] memory migrated, uint256 count)
  {
    return internalMigrateToToken(target);
  }

  function admin_setHook(IMigratorHook hook) public onlyOwner {
    _migrateHook = hook;
  }

  /// @dev admin_sweepToken allows an owner to handle funds accidentially sent to the adapter or migrator contract.
  /// When an adapter is swept, following limitations apply for safety reasons:
  /// 1. target asset can not be swept after migration as there will be unclaimed funds.
  /// 2. origin and underlying assets can only be swept after migration (residuals).
  /// Migrator itself can be swept at any moment.
  function admin_sweepToken(
    address holder,
    address token,
    address to
  ) external onlyOwner returns (uint256) {
    if (holder != address(this)) {
      return IMigrationAdapter(holder).admin_sweepToken(token, to);
    }

    require(to != address(0), 'valid destination is required');
    uint256 amount = IERC20(token).balanceOf(address(this));
    if (amount > 0) {
      IERC20(token).safeTransfer(to, amount);
    }
    return amount;
  }

  function internalMigrateToToken(ILendableToken target)
    internal
    returns (IMigrationAdapter[] memory migrated, uint256 count)
  {
    address underlying = target.UNDERLYING_ASSET_ADDRESS();
    uint256[] storage indices = _underlyings[underlying];
    if (indices.length == 0) {
      return (migrated, 0);
    }
    migrated = new IMigrationAdapter[](indices.length);
    address[] memory rewardPools = new address[](indices.length);

    for (uint256 i = 0; i < indices.length; i++) {
      IMigrationAdapter adapter = _adaptersList[indices[i]];
      if (address(adapter) == address(0)) {
        continue;
      }
      adapter.admin_migrateAll(target);
      migrated[count] = adapter;
      rewardPools[count] = adapter.getRewardPool();
      count++;
    }

    if (_migrateHook != IMigratorHook(0)) {
      _migrateHook.handleTokenMigrated(underlying, rewardPools);
    }

    return (migrated, count);
  }

  function admin_enableClaims(IMigrationAdapter[] memory migrated) public onlyOwner {
    internalEnableClaims(migrated);
  }

  function internalEnableClaims(IMigrationAdapter[] memory migrated) private {
    for (uint256 i = 0; i < migrated.length; i++) {
      if (address(migrated[i]) == address(0)) {
        continue;
      }
      migrated[i].admin_enableClaims();
    }
  }

  function admin_migrateAllThenEnableClaims(ILendableToken[] memory targets)
    public
    onlyOwner
    returns (uint256 count)
  {
    IMigrationAdapter[][] memory migrateds = new IMigrationAdapter[][](targets.length);
    for (uint256 i = 0; i < targets.length; i++) {
      uint256 migratedCount;
      (migrateds[i], migratedCount) = internalMigrateToToken(targets[i]);
      count += migratedCount;
    }

    for (uint256 i = 0; i < migrateds.length; i++) {
      internalEnableClaims(migrateds[i]);
    }

    return count;
  }
}
