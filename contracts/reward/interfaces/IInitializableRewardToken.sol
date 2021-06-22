// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IRemoteAccessBitmask} from '../../access/interfaces/IRemoteAccessBitmask.sol';

/**
 * @title IInitializableStakeToken
 * @notice Interface for the initialize function on StakeToken and VotingToken
 **/
interface IInitializableRewardToken {
  event Initialized(IRemoteAccessBitmask remoteAcl, string tokenName, string tokenSymbol);

  function initialize(
    IRemoteAccessBitmask remoteAcl,
    string calldata name,
    string calldata symbol
  ) external;
}
