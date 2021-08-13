// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IEmergencyAccessGroup {
  function setPausedFor(address subject, bool paused) external;

  function isPausedFor(address subject) external view returns (bool);

  function listEmergencyGroup() external view returns (address[] memory);
}
