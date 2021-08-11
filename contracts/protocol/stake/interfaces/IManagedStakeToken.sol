// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../interfaces/IEmergencyAccess.sol';

interface IManagedStakeToken is IEmergencyAccess {
  function setRedeemable(bool redeemable) external;

  function getMaxSlashablePercentage() external view returns (uint16);

  function setMaxSlashablePercentage(uint16 percentage) external;

  function setCooldown(uint32 cooldownPeriod, uint32 unstakePeriod) external;

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external returns (uint256);
}
