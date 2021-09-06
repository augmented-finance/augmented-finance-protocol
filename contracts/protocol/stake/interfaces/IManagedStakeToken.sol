// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../interfaces/IEmergencyAccess.sol';

interface IManagedStakeToken is IEmergencyAccess {
  event Slashed(address to, uint256 amount, uint256 totalBeforeSlash);

  event MaxSlashUpdated(uint16 maxSlash);
  event CooldownUpdated(uint32 cooldownPeriod, uint32 unstakePeriod);

  event RedeemableUpdated(bool redeemable);

  function setRedeemable(bool redeemable) external;

  function setMaxSlashablePercentage(uint16 percentage) external;

  function setCooldown(uint32 cooldownPeriod, uint32 unstakePeriod) external;

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external returns (uint256 amount, bool erc20Transfer);
}
