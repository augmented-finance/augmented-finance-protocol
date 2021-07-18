// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IRemoteAccessBitmask} from '../../access/interfaces/IRemoteAccessBitmask.sol';

interface IInitializableRewardToken {
  struct InitData {
    IRemoteAccessBitmask remoteAcl;
    string name;
    string symbol;
    uint8 decimals;
  }

  function initialize(InitData memory) external;
}
