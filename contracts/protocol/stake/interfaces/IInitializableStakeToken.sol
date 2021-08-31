// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './StakeTokenConfig.sol';

/// @dev Interface for the initialize function on StakeToken
interface IInitializableStakeToken {
  event Initialized(StakeTokenConfig params, string tokenName, string tokenSymbol);

  function initializeStakeToken(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol
  ) external;

  function initializedStakeTokenWith()
    external
    view
    returns (
      StakeTokenConfig memory params,
      string memory name,
      string memory symbol
    );
}
