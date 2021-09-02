// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IRemoteAccessBitmask.sol';
import './IAccessController.sol';

interface IManagedAccessController is IAccessController {
  function setTemporaryAdmin(address admin, uint32 expiryBlocks) external;

  function getTemporaryAdmin() external view returns (address admin, uint256 expiresAtBlock);

  function renounceTemporaryAdmin() external;

  function setAddress(uint256 id, address newAddress) external;

  function setAddressAsProxy(uint256 id, address impl) external;

  function setAddressAsProxyWithInit(
    uint256 id,
    address impl,
    bytes calldata initCall
  ) external;

  function directCallWithRoles(
    uint256 flags,
    address addr,
    bytes calldata data
  ) external returns (bytes memory result);

  struct CallParams {
    uint256 accessFlags;
    uint256 callFlag;
    address callAddr;
    bytes callData;
  }

  function callWithRoles(CallParams[] calldata params) external returns (bytes[] memory result);

  event ProxyCreated(uint256 indexed id, address indexed newAddress);
  event AddressSet(uint256 indexed id, address indexed newAddress, bool hasProxy);
  event RolesUpdated(address indexed addr, uint256 flags);
  event TemporaryAdminAssigned(address indexed admin, uint256 expiresAt);
  event AnyRoleModeEnabled();
  event AnyRoleModeBlocked();
}
