// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../access/interfaces/IMarketAccessController.sol';
import '../protocol/libraries/types/DataTypes.sol';

interface ILendingPoolForTokens {
  /**
   * @dev Validates and finalizes an depositToken transfer
   * - Only callable by the overlying depositToken of the `asset`
   * @param asset The address of the underlying asset of the depositToken
   * @param from The user from which the depositToken are transferred
   * @param to The user receiving the depositToken
   * @param amount The amount being transferred/withdrawn
   * @param balanceFromBefore The depositToken balance of the `from` user before the transfer
   * @param balanceToBefore The depositToken balance of the `to` user before the transfer
   */
  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromBefore,
    uint256 balanceToBefore
  ) external;

  function getAccessController() external view returns (IMarketAccessController);

  function getReserveNormalizedIncome(address asset) external view returns (uint256);

  function getReserveNormalizedVariableDebt(address asset) external view returns (uint256);

  function getConfiguration(address asset)
    external
    view
    returns (DataTypes.ReserveConfigurationMap memory);

  function getReserveData(address asset) external view returns (DataTypes.ReserveData memory);
}
