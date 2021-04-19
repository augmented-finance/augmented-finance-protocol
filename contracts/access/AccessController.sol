// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import 'hardhat/console.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

// Prettier ignore to prevent buidler flatter bug
// prettier-ignore
import {InitializableImmutableAdminUpgradeabilityProxy} from '../protocol/libraries/aave-upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';

import {IManagedAccessController} from '../interfaces/IAccessController.sol';
import {AccessFlags} from './AccessFlags.sol';

contract AccessController is Ownable, IManagedAccessController {
  mapping(bytes32 => address) private _addresses;
  mapping(address => uint256) private _masks;

  function getAccessControlMask(address addr) external view override returns (uint256) {
    return _masks[addr];
  }

  function grantRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    uint256 m = _masks[addr];
    if (m & flags != flags) {
      m |= flags;
      _masks[addr] = m;
    }
    return m;
  }

  function revokeRoles(address addr, uint256 flags) external onlyOwner returns (uint256) {
    uint256 m = _masks[addr];
    if (m & flags != 0) {
      m &= ~flags;
      _masks[addr] = m;
    }
    return m;
  }

  /**
   * @dev Sets an address for an id replacing the address saved in the addresses map
   * IMPORTANT Use this function carefully, as it will do a hard replacement
   * @param id The id
   * @param newAddress The address to set
   */
  function setAddress(bytes32 id, address newAddress) external override onlyOwner {
    _addresses[id] = newAddress;
    emit AddressSet(id, newAddress, false);
  }

  function internalSetAddress(bytes32 id, address newAddress) internal onlyOwner {
    _addresses[id] = newAddress;
  }

  /**
   * @dev Returns an address by id
   * @return The address
   */
  function getAddress(bytes32 id) public view override returns (address) {
    return _addresses[id];
  }

  function isAddress(bytes32 id, address addr) public view returns (bool) {
    return addr != address(0) && addr == _addresses[id];
  }

  function isEmergencyAdmin(address addr) external view override returns (bool) {
    return isAddress(AccessFlags.EMERGENCY_ADMIN, addr);
  }

  function getEmergencyAdmin() external view override returns (address) {
    return getAddress(AccessFlags.EMERGENCY_ADMIN);
  }

  function setEmergencyAdmin(address emergencyAdmin) external override onlyOwner {
    _addresses[AccessFlags.EMERGENCY_ADMIN] = emergencyAdmin;
    emit EmergencyAdminUpdated(emergencyAdmin);
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
  function setAddressAsProxy(bytes32 id, address implementationAddress)
    external
    override
    onlyOwner
  {
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
  function _updateImpl(bytes32 id, address newAddress) internal {
    address payable proxyAddress = payable(getAddress(id));

    InitializableImmutableAdminUpgradeabilityProxy proxy =
      InitializableImmutableAdminUpgradeabilityProxy(proxyAddress);
    bytes memory params = abi.encodeWithSignature('initialize(address)', address(this));

    if (proxyAddress == address(0)) {
      proxy = new InitializableImmutableAdminUpgradeabilityProxy(address(this));
      proxy.initialize(newAddress, params);
      internalSetAddress(id, address(proxy));
      emit ProxyCreated(id, address(proxy));
    } else {
      proxy.upgradeToAndCall(newAddress, params);
    }
  }
}
