// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IRemoteAccessBitmask} from '../../access/interfaces/IRemoteAccessBitmask.sol';

/**
 * @title IInitializableStakeToken
 * @notice Interface for the initialize function on StakeToken
 **/
interface IInitializableRewardToken {
  event Initialized(IRemoteAccessBitmask remoteAcl, string tokenName, string tokenSymbol);

  struct InitData {
    IRemoteAccessBitmask remoteAcl;
    string name;
    string symbol;
    uint8 decimals;
  }

  function initialize(InitData calldata) external;
}
