// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {VersionedInitializable} from '../tools/upgradeability/VersionedInitializable.sol';
import {RemoteAccessBitmask} from '../access/RemoteAccessBitmask.sol';
import {IRemoteAccessBitmask} from '../access/interfaces/IRemoteAccessBitmask.sol';
import {AccessFlags} from '../access/AccessFlags.sol';

contract Treasury is VersionedInitializable, RemoteAccessBitmask {
  uint256 private constant TREASURY_REVISION = 1;

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address remoteAcl) external virtual initializerRunAlways(TREASURY_REVISION) {
    _remoteAcl = IRemoteAccessBitmask(remoteAcl);
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return TREASURY_REVISION;
  }

  function approve(
    address token,
    address recipient,
    uint256 amount
  ) external aclHas(AccessFlags.TREASURY_ADMIN) {
    IERC20(token).approve(recipient, amount);
  }

  function transfer(
    address token,
    address recipient,
    uint256 amount
  ) external aclHas(AccessFlags.TREASURY_ADMIN) {
    IERC20(token).transfer(recipient, amount);
  }
}
