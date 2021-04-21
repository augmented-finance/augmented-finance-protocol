// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {BitUtils} from '../../tools/math/BitUtils.sol';

interface IRemoteAccessBitmask {
  function getAccessControlMask(address) external view returns (uint256);

  function queryAccessControlMask(address addr, uint256 filterMask) external view returns (uint256);
}

/**
 * @title RemoteAccessBitmaskHelper
 * @dev Wrapper around IRemoteAccessBitmask
 */
library RemoteAccessBitmaskHelper {
  using BitUtils for uint256;

  function getAcl(IRemoteAccessBitmask remote, address subject) internal view returns (uint256) {
    return remote.getAccessControlMask(subject);
  }

  function queryAcl(
    IRemoteAccessBitmask remote,
    address subject,
    uint256 filterMask
  ) internal view returns (uint256) {
    return remote.queryAccessControlMask(subject, filterMask);
  }

  function hasAnyOf(
    IRemoteAccessBitmask remote,
    address subject,
    uint256 flags
  ) internal view returns (bool) {
    return queryAcl(remote, subject, flags).hasAnyOf(flags);
  }

  function hasAllOf(
    IRemoteAccessBitmask remote,
    address subject,
    uint256 flags
  ) internal view returns (bool) {
    return queryAcl(remote, subject, flags).hasAllOf(flags);
  }

  function hasNoneOf(
    IRemoteAccessBitmask remote,
    address subject,
    uint256 flags
  ) internal view returns (bool) {
    return queryAcl(remote, subject, flags).hasNoneOf(flags);
  }

  function hasAny(IRemoteAccessBitmask remote, address subject) internal view returns (bool) {
    return remote.getAccessControlMask(subject) != 0;
  }

  function hasNone(IRemoteAccessBitmask remote, address subject) internal view returns (bool) {
    return remote.getAccessControlMask(subject) == 0;
  }
}
