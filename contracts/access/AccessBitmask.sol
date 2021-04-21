// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';

contract AccessBitmask is Context {
  mapping(address => uint256) private _acl;

  function _grantAcl(address addr, uint256 flags) internal {
    if (flags == 0) {
      return;
    }
    _acl[addr] = _acl[addr] | flags;
  }

  function _revokeAcl(address addr, uint256 flags) internal {
    if (flags == 0 || _acl[addr] == 0) {
      return;
    }
    _acl[addr] = _acl[addr] & (~flags);
  }

  function _revokeAllAcl(address addr) internal {
    delete (_acl[addr]);
  }

  function _setAcl(address addr, uint256 flags) internal {
    _acl[addr] = flags;
  }

  function _getAcl(address addr) internal view returns (uint256) {
    return _acl[addr];
  }

  modifier aclHas(uint256 flags) {
    require((_acl[_msgSender()] & flags) == flags, 'access is restricted');
    _;
  }

  modifier aclAllOf(uint256 flags) {
    require((_acl[_msgSender()] & flags) == flags, 'access is restricted');
    _;
  }

  modifier aclNoneOf(uint256 flags) {
    require((_acl[_msgSender()] & flags) == 0, 'access is restricted');
    _;
  }

  modifier aclAnyOf(uint256 flags) {
    require((_acl[_msgSender()] & flags) != 0, 'access is restricted');
    _;
  }

  modifier aclAny() {
    require(_acl[_msgSender()] != 0, 'access is restricted');
    _;
  }

  modifier aclNone() {
    require(_acl[_msgSender()] == 0, 'access is restricted');
    _;
  }

  // modifier aclHas_(uint256 flags, string memory m) {
  //   require((_acl[_msgSender()] & flags) == flags, m);
  //   _;
  // }

  // modifier aclAllOf_(uint256 flags, string memory m) {
  //   require((_acl[_msgSender()] & flags) == flags, m);
  //   _;
  // }

  // modifier aclNoneOf_(uint256 flags, string memory m) {
  //   require((_acl[_msgSender()] & flags) == 0, m);
  //   _;
  // }

  // modifier aclAnyOf_(uint256 flags, string memory m) {
  //   require((_acl[_msgSender()] & flags) != 0, m);
  //   _;
  // }

  // modifier aclAny_(string memory m) {
  //   require(_acl[_msgSender()] != 0, m);
  //   _;
  // }

  // modifier aclNone_(string memory m) {
  //   require(_acl[_msgSender()] == 0, m);
  //   _;
  // }
}
