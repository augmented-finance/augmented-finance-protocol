// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import '../protocol/libraries/types/DataTypes.sol';
import '../interfaces/IEmergencyAccess.sol';
import '../access/interfaces/IMarketAccessController.sol';

interface IManagedLendingPool is IEmergencyAccess {
  function initReserve(DataTypes.InitReserveData calldata data) external;

  function setReserveStrategy(address reserve, address rateStrategyAddress) external;

  function setConfiguration(address reserve, uint256 configuration) external;

  function getLendingPoolExtension() external view returns (address);

  function setLendingPoolExtension(address) external;

  /// @dev Version of flashLoan with access control and with zero premium. For automated liquidity management.
  function trustedFlashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint256 referral
  ) external;
}
