// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

import {BitUtils} from '../tools/math/BitUtils.sol';

// prettier-ignore
import {InitializableImmutableAdminUpgradeabilityProxy} from '../tools/upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';
import {IProxy} from '../tools/upgradeability/IProxy.sol';

import {IManagedAccessController} from './interfaces/IAccessController.sol';
import {AccessFlags} from './AccessFlags.sol';

contract AccessController is Ownable, IManagedAccessController {
  using BitUtils for uint256;

  mapping(uint256 => address) private _addresses;
  mapping(address => uint256) private _masks;
  mapping(uint256 => address[]) private _grantees;
  uint256 private _nonSingletons;
  uint256 private _singletons;
  uint256 private _proxies;

  mapping(string => address) private _implementations;

  function queryAccessControlMask(address addr, uint256 filter)
    external
    view
    override
    returns (uint256 flags)
  {
    flags = _masks[addr];
    if (filter == 0) {
      return flags;
    }
    return flags & filter;
  }

  function grantRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    uint256 m = _masks[addr];
    flags &= ~m;
    if (flags == 0) {
      return m;
    }

    _nonSingletons |= flags;
    m |= flags;
    _masks[addr] = m;

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & flags == 0) {
        if (mask > flags) {
          break;
        }
        continue;
      }
      _grantees[mask].push(addr);
    }
    return m;
  }

  function revokeRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    return _revokeRoles(addr, flags);
  }

  function _revokeRoles(address addr, uint256 flags) private returns (uint256) {
    uint256 m = _masks[addr];
    if (m & flags != 0) {
      m &= ~flags;
      _masks[addr] = m;
    }
    return m;
  }

  function revokeRolesFromAll(uint256 flags, uint256 limit) external onlyOwner returns (bool) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & flags == 0) {
        if (mask > flags) {
          break;
        }
        continue;
      }
      address[] storage grantees = _grantees[mask];
      for (uint256 j = grantees.length; j > 0; ) {
        j--;
        if (limit == 0) {
          return false;
        }
        limit--;
        _revokeRoles(grantees[j], mask);
        grantees.pop();
      }
    }
    return true;
  }

  function roleGrantees(uint256 id) external view returns (address[] memory addrList) {
    if (_singletons & id == 0) {
      require(id.isPowerOf2nz(), 'only one role is allowed');
      return _grantees[id];
    }

    address addr = getAddress(id);
    if (addr != address(0)) {
      addrList = new address[](1);
      addrList[0] = addr;
    }
    return addrList;
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

  function setAddressAsProxyWithInit(
    uint256 id,
    address implementationAddress,
    bytes calldata params
  ) public override onlyOwner {
    _updateCustomImpl(id, implementationAddress, params);
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

    bytes memory params = abi.encodeWithSignature('initialize(address)', address(this));

    if (proxyAddress != address(0)) {
      InitializableImmutableAdminUpgradeabilityProxy(proxyAddress).upgradeToAndCall(
        newAddress,
        params
      );
      return;
    }

    proxyAddress = payable(_createProxy(address(this), newAddress, params));
    _internalSetAddress(id, proxyAddress);
    _proxies |= id;
    emit ProxyCreated(id, proxyAddress);
  }

  function _updateCustomImpl(
    uint256 id,
    address newAddress,
    bytes calldata params
  ) private {
    require(id.isPowerOf2nz(), 'invalid singleton id');
    address payable proxyAddress = payable(getAddress(id));

    if (proxyAddress != address(0)) {
      InitializableImmutableAdminUpgradeabilityProxy(proxyAddress).upgradeToAndCall(
        newAddress,
        params
      );
      return;
    }

    proxyAddress = payable(address(createProxy(address(this), newAddress, params)));
    _internalSetAddress(id, proxyAddress);
    _proxies |= id;
    emit ProxyCreated(id, proxyAddress);
  }

  function _createProxy(
    address adminAddress,
    address implAddress,
    bytes memory params
  ) private returns (InitializableImmutableAdminUpgradeabilityProxy) {
    InitializableImmutableAdminUpgradeabilityProxy proxy =
      new InitializableImmutableAdminUpgradeabilityProxy(adminAddress);
    proxy.initialize(implAddress, params);
    return proxy;
  }

  function createProxy(
    address adminAddress,
    address implAddress,
    bytes calldata params
  ) public override returns (IProxy) {
    require(implAddress != address(0), 'implementation is required');

    InitializableImmutableAdminUpgradeabilityProxy proxy =
      new InitializableImmutableAdminUpgradeabilityProxy(adminAddress);
    proxy.initialize(implAddress, params);
    return proxy;
  }

  function createProxyByName(
    address adminAddress,
    string calldata implName,
    bytes calldata params
  ) public override returns (IProxy) {
    return createProxy(adminAddress, getImplementation(implName), params);
  }

  function getImplementation(string calldata id) public view override returns (address) {
    return _implementations[id];
  }

  function addImplementation(string calldata id, address addr) public override {
    require(addr != address(0), 'implementation is required');
    address a = _implementations[id];
    if (a == addr) {
      return;
    }
    require(a == address(0), 'conflicting implementations');
    _implementations[id] = addr;
  }
}
