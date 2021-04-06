// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {ISubscriptionAdapter} from './interfaces/ISubscriptionAdapter.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {ILendableToken} from './interfaces/ILendableToken.sol';

contract Migrator is Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  ISubscriptionAdapter[] private _adaptersList;
  /* a/c/dToken */
  mapping(address => uint256) private _adapters;
  /* underlying */
  mapping(address => uint256[]) private _underlyings;

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

  function getAdapter(address token) public view returns (ISubscriptionAdapter adapter) {
    uint256 adapterIdx = _adapters[token];
    require(adapterIdx > 0, 'unknown or unsupported token');
    return _adaptersList[adapterIdx - 1];
  }

  function registerAdapter(ISubscriptionAdapter adapter) public onlyOwner {
    address underlying = adapter.UNDERLYING_ASSET_ADDRESS();
    require(IERC20(underlying).totalSupply() > 0, 'valid underlying is required');

    address origin = adapter.ORIGIN_ASSET_ADDRESS();
    require(IERC20(origin).totalSupply() > 0, 'valid origin is required');

    // TODO    adapter.admin_claimOwnership();

    require(address(_adapters[origin]) == address(0), 'token is already registered');
    _adaptersList.push(adapter);
    _adapters[origin] = _adaptersList.length;
    _underlyings[underlying].push(_adaptersList.length);
  }

  function unregisterAdapter(ISubscriptionAdapter adapter) public onlyOwner returns (bool) {
    address origin = adapter.ORIGIN_ASSET_ADDRESS();
    if (_adapters[origin] == 0) {
      return false;
    }
    uint256 idx = _adapters[origin] - 1;
    if (_adaptersList[idx] != adapter) {
      return false;
    }
    delete (_adapters[origin]);
    _adaptersList[idx] = ISubscriptionAdapter(address(0));
    return true;
  }

  function unregisterAdapterForToken(address origin) public onlyOwner returns (bool) {
    if (_adapters[origin] == 0) {
      return false;
    }
    uint256 idx = _adapters[origin] - 1;
    if (address(_adaptersList[idx]) == address(0)) {
      return false;
    }
    _adaptersList[idx] = ISubscriptionAdapter(address(0));
    delete (_adapters[origin]);
    return true;
  }

  function migrateToToken(ILendableToken target)
    public
    onlyOwner
    returns (ISubscriptionAdapter[] memory migrated)
  {
    address underlying = target.UNDERLYING_ASSET_ADDRESS();
    uint256[] storage indices = _underlyings[underlying];
    if (indices.length == 0) {
      return migrated;
    }
    migrated = new ISubscriptionAdapter[](indices.length);
    uint256 j = 0;

    for (uint256 i = 0; i < indices.length; i++) {
      ISubscriptionAdapter adapter = _adaptersList[indices[i]];
      if (address(adapter) == address(0)) {
        continue;
      }
      adapter.admin_migrateAll(target);
      migrated[j] = adapter;
      j++;
    }
    return migrated;
  }
}
