// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import './ILendingPool.sol';
import '../protocol/libraries/types/DataTypes.sol';
import '../interfaces/IEmergencyAccess.sol';
import '../access/interfaces/IMarketAccessController.sol';

interface IOnlyManagedLendingPool is IEmergencyAccess {
  function initReserve(DataTypes.InitReserveData calldata data) external;

  function setReserveStrategy(address reserve, address rateStrategyAddress) external;

  function setConfiguration(address reserve, uint256 configuration) external;

  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromAfter,
    uint256 balanceToBefore
  ) external;

  function getLendingPoolExtension() external view returns (address);

  function setLendingPoolExtension(address) external;
}

interface IManagedLendingPool is ILendingPool, IOnlyManagedLendingPool {}
