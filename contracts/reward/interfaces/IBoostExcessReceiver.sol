// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IBoostExcessReceiver {
  function receiveBoostExcess(uint256 amount, uint32 since) external;
}
