// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {ISubscriptionAdapter} from './interfaces/ISubscriptionAdapter.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';

contract Migrator is Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  //  address internal _underlyingToken;
  address internal _originToken;
  //  address internal _targetToken;
  mapping(address => ISubscriptionAdapter) private _adapters;

  modifier notMigrated() {
    //    require(_targetAddress == address(0), 'migration completed');
    _;
  }

  modifier migrated() {
    //    require(_targetAddress != address(0), 'migration pending');
    _;
  }

  function depositToMigrate(
    uint256 amount,
    address token,
    uint64 referralCode
  ) public notMigrated returns (uint256 amount_) {
    return getAdapter(token).depositToMigrate(amount, msg.sender, referralCode);
  }

  function withdrawFromMigrate(uint256 maxAmount, address token)
    public
    notMigrated
    returns (uint256)
  {
    return getAdapter(token).withdrawFromMigrate(maxAmount);
  }

  function balanceForMigrate(address holder, address token) public view returns (uint256 amount) {
    return getAdapter(token).balanceForMigrate(holder);
  }

  function registerAdapter(ISubscriptionAdapter adapter) public onlyOwner {
    require(address(adapter) != address(0), 'adapter is required');
    //      require(adapter.owner() == owner(), 'adapter must belong to the same owner');

    require(adapter.UNDERLYING_ASSET_ADDRESS() != address(0), 'underlying is required');

    address origin = adapter.ORIGIN_ASSET_ADDRESS();
    require(origin != address(0), 'origin is required');
    //      require(adapter.TARGET_ASSET_ADDRESS() != address(0), 'target is required');

    require(address(_adapters[origin]) == address(0), 'token is already registered');
    _adapters[origin] = adapter;
  }

  function unregisterAdapterForToken(address origin) public onlyOwner {
    delete _adapters[origin];
  }

  function getAdapter(address token) private view returns (ISubscriptionAdapter adapter) {
    adapter = _adapters[token];
    require(address(adapter) != address(0), 'unknown or unsupported token');
    return adapter;
  }
}
