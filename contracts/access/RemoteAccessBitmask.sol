// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {
  IRemoteAccessBitmask,
  RemoteAccessBitmaskHelper
} from './interfaces/IRemoteAccessBitmask.sol';

contract RemoteAccessBitmask is Context {
  using RemoteAccessBitmaskHelper for IRemoteAccessBitmask;
  IRemoteAccessBitmask internal _remoteAcl;

  constructor(IRemoteAccessBitmask remoteAcl) public {
    _remoteAcl = remoteAcl;
  }

  function _getRemoteAcl(address addr) internal view returns (uint256) {
    return _remoteAcl.getAcl(addr);
  }

  modifier aclHas(uint256 flags) virtual {
    require(_remoteAcl.hasAllOf(_msgSender(), flags), 'access is restricted');
    _;
  }

  modifier aclAllOf(uint256 flags) {
    require(_remoteAcl.hasAllOf(_msgSender(), flags), 'access is restricted');
    _;
  }

  modifier aclNoneOf(uint256 flags) {
    require(_remoteAcl.hasNoneOf(_msgSender(), flags), 'access is restricted');
    _;
  }

  modifier aclAnyOf(uint256 flags) {
    require(_remoteAcl.hasAnyOf(_msgSender(), flags), 'access is restricted');
    _;
  }

  modifier aclAny() {
    require(_remoteAcl.hasAny(_msgSender()), 'access is restricted');
    _;
  }

  modifier aclNone() {
    require(_remoteAcl.hasNone(_msgSender()), 'access is restricted');
    _;
  }
}
