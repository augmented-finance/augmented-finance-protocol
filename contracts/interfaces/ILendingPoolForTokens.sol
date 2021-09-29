// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/interfaces/IMarketAccessController.sol';
import '../protocol/libraries/types/DataTypes.sol';

interface ILendingPoolForTokens {
  /**
   * @dev Validates and finalizes an depositToken transfer
   * - Only callable by the overlying depositToken of the `asset`
   * @param asset The address of the underlying asset of the depositToken
   * @param from The user from which the depositToken are transferred
   * @param to The user receiving the depositToken
   * @param lastBalanceFrom True when from's balance was non-zero and became zero
   * @param firstBalanceTo True when to's balance was zero and became non-zero
   */
  function finalizeTransfer(
    address asset,
    address from,
    address to,
    bool lastBalanceFrom,
    bool firstBalanceTo
  ) external;

  function getAccessController() external view returns (IMarketAccessController);

  function getReserveNormalizedIncome(address asset) external view returns (uint256);

  function getReserveNormalizedVariableDebt(address asset) external view returns (uint256);

  function getConfiguration(address asset) external view returns (DataTypes.ReserveConfigurationMap memory);

  function getReserveData(address asset) external view returns (DataTypes.ReserveData memory);

  function getReservesList() external view returns (address[] memory);

  function setReservePaused(address asset, bool paused) external;
}
