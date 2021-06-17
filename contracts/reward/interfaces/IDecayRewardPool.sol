// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

// import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';
import {IEmergencyAccess} from '../../interfaces/IEmergencyAccess.sol';

interface IDecayRewardPool {
  function handleDecayBalanceUpdate(
    address holder,
    uint256 newBalance,
    uint256 totalSupply,
    uint32 decayPeriod
  ) external;

  function handleDecayTotalUpdate(
    uint256 totalSupply,
    uint256 totalDecay,
    uint32 decayPeriod,
    uint32 updatedAt
  ) external;
}

interface IDecayRewardProvider {
  function updateTotalSupply() external;

  function updateBalanceOf(address) external;
}
