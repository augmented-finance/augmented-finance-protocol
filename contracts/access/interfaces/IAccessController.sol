// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IRemoteAccessBitmask} from './IRemoteAccessBitmask.sol';
import {IProxy} from '../../tools/upgradeability/IProxy.sol';

/**
 * @title IAccessController contract
 * @dev Main registry of permissions and related addresses
 **/
interface IAccessController is IRemoteAccessBitmask {
  function getAddress(uint256 id) external view returns (address);

  function isEmergencyAdmin(address admin) external view returns (bool);

  function createProxy(
    address admin,
    address impl,
    bytes calldata params
  ) external returns (IProxy);

  function createProxyByName(
    address admin,
    string calldata implName,
    bytes calldata params
  ) external returns (IProxy);

  function getImplementation(string calldata id) external view returns (address);
  //  function getFirstImplementation(string[] calldata ids) external view returns (address);
}

interface IManagedAccessController is IAccessController {
  function setAddress(uint256 id, address newAddress) external;

  function addImplementation(string calldata id, address addr) external;

  function setAddressAsProxy(uint256 id, address impl) external;

  function setAddressAsProxyWithInit(
    uint256 id,
    address impl,
    bytes calldata initCall
  ) external;

  function getEmergencyAdmin() external view returns (address);

  function setEmergencyAdmin(address admin) external;

  event ProxyCreated(uint256 indexed id, address indexed newAddress);
  event AddressSet(uint256 indexed id, address indexed newAddress, bool hasProxy);
  event EmergencyAdminUpdated(address indexed newAddress);
}
