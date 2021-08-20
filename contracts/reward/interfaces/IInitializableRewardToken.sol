// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../access/interfaces/IMarketAccessController.sol';

interface IInitializableRewardToken {
  struct InitRewardTokenData {
    IMarketAccessController remoteAcl;
    string name;
    string symbol;
    uint8 decimals;
  }

  function initializeRewardToken(InitRewardTokenData memory) external;
}
