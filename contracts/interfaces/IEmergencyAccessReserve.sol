// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IEmergencyAccessReserve {
  function setReservePaused(address asset, bool paused) external;

  function isReservePaused(address asset) external view returns (bool);
}
