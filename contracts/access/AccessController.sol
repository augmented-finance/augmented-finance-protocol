// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

import {BitUtils} from '../tools/math/BitUtils.sol';

// Prettier ignore to prevent buidler flatter bug
// prettier-ignore
import {InitializableImmutableAdminUpgradeabilityProxy} from '../tools/upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';

import {IManagedAccessController} from './interfaces/IAccessController.sol';
import {AccessFlags} from './AccessFlags.sol';

contract AccessController is Ownable, IManagedAccessController {
  using BitUtils for uint256;

  mapping(uint256 => address) private _addresses;
  mapping(address => uint256) private _masks;
  uint256 private _nonSingletons;
  uint256 private _singletons;
  uint256 private _proxies;

  function getAccessControlMask(address addr) external view override returns (uint256) {
    return _masks[addr];
  }

  function queryAccessControlMask(address addr, uint256 filter)
    external
    view
    override
    returns (uint256)
  {
    return _masks[addr] & filter;
  }

  function grantRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    uint256 m = _masks[addr];
    if (m & flags != flags) {
      _nonSingletons |= flags;
      m |= flags;
      _masks[addr] = m;
    }
    return m;
  }

  function revokeRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    uint256 m = _masks[addr];
    if (m & flags != 0) {
      m &= ~flags;
      _masks[addr] = m;
    }
    return m;
  }

  /**
   * @dev Sets a sigleton address, replaces previous value
   * IMPORTANT Use this function carefully, as it does a hard replacement
   * @param id The id
   * @param newAddress The address to set
   */
  function setAddress(uint256 id, address newAddress) public override onlyOwner {
    require(_proxies & id == 0, 'use of setAddressAsProxy is required');
    _internalSetAddress(id, newAddress);
    emit AddressSet(id, newAddress, false);
  }

  function _internalSetAddress(uint256 id, address newAddress) private {
    require(id.isPowerOf2nz(), 'invalid singleton id');
    if (_singletons & id == 0) {
      require(_nonSingletons & id == 0, 'id is not a singleton');
      _singletons |= id;
    }

    address prev = _addresses[id];
    if (prev != address(0)) {
      _masks[prev] = _masks[prev] & ~id;
    }
    if (newAddress != address(0)) {
      _masks[newAddress] = _masks[newAddress] | id;
    }
    _addresses[id] = newAddress;
  }

  /**
   * @dev Returns a singleton address by id
   * @return addr The address
   */
  function getAddress(uint256 id) public view override returns (address addr) {
    addr = _addresses[id];

    if (addr == address(0)) {
      require(id.isPowerOf2nz(), 'invalid singleton id');
      require((_singletons & id != 0) || (_nonSingletons & id == 0), 'id is not a singleton');
    }
    return addr;
  }

  function isAddress(uint256 id, address addr) public view returns (bool) {
    // require(id.isPowerOf2nz(), 'only singleton id is accepted');
    return _masks[addr] & id != 0;
  }

  function isEmergencyAdmin(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.EMERGENCY_ADMIN, addr);
  }

  function getEmergencyAdmin() external view override returns (address) {
    return getAddress(AccessFlags.EMERGENCY_ADMIN);
  }

  function setEmergencyAdmin(address emergencyAdmin) external override onlyOwner {
    _internalSetAddress(AccessFlags.EMERGENCY_ADMIN, emergencyAdmin);
    emit EmergencyAdminUpdated(emergencyAdmin);
  }

  function markProxies(uint256 id) external onlyOwner {
    _proxies |= id;
  }

  function unmarkProxies(uint256 id) external onlyOwner {
    _proxies &= ~id;
  }

  /**
   * @dev General function to update the implementation of a proxy registered with
   * certain `id`. If there is no proxy registered, it will instantiate one and
   * set as implementation the `implementationAddress`
   * IMPORTANT Use this function carefully, only for ids that don't have an explicit
   * setter function, in order to avoid unexpected consequences
   * @param id The id
   * @param implementationAddress The address of the new implementation
   */
  function setAddressAsProxy(uint256 id, address implementationAddress) public override onlyOwner {
    _updateImpl(id, implementationAddress);
    emit AddressSet(id, implementationAddress, true);
  }

  /**
   * @dev Internal function to update the implementation of a specific proxied component of the protocol
   * - If there is no proxy registered in the given `id`, it creates the proxy setting `newAdress`
   *   as implementation and calls the initialize() function on the proxy
   * - If there is already a proxy registered, it just updates the implementation to `newAddress` and
   *   calls the initialize() function via upgradeToAndCall() in the proxy
   * @param id The id of the proxy to be updated
   * @param newAddress The address of the new implementation
   **/
  function _updateImpl(uint256 id, address newAddress) private {
    require(id.isPowerOf2nz(), 'invalid singleton id');
    address payable proxyAddress = payable(getAddress(id));

    InitializableImmutableAdminUpgradeabilityProxy proxy =
      InitializableImmutableAdminUpgradeabilityProxy(proxyAddress);
    bytes memory params = abi.encodeWithSignature('initialize(address)', address(this));

    if (proxyAddress == address(0)) {
      proxy = new InitializableImmutableAdminUpgradeabilityProxy(address(this));
      proxy.initialize(newAddress, params);
      _internalSetAddress(id, address(proxy));
      _proxies |= id;
      emit ProxyCreated(id, address(proxy));
    } else {
      proxy.upgradeToAndCall(newAddress, params);
    }
  }
}
