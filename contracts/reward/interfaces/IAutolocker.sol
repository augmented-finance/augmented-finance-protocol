// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

enum AutolockMode {Default, Stop, Prolongate, AccumulateUnderlying, AccumulateTill, KeepUpBalance}

interface IAutolocker {
  function applyAutolock(
    address account,
    uint256 amount,
    AutolockMode mode,
    uint32 lockDuration,
    uint224 param
  ) external returns (address receiver, uint256 lockAmount);
}
