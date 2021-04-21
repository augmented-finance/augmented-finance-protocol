// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IAccessController} from '../../../access/interfaces/IAccessController.sol';

/**
 * @title IStakeAccessController contract
 * @dev Main registry of permissions for stake contracts
 **/
interface IStakeAccessController is IAccessController {
  function isStakeAdmin(address) external view returns (bool);

  function isLiquidityController(address) external view returns (bool);

  function isSlashDestination(address) external view returns (bool);
}
