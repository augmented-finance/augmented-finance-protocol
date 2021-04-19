// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {VotingToken} from './VotingToken.sol';
import {StakeToken} from './StakeToken.sol';

import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';

/**
 * @title StakedAgfV1
 * @notice Staked AGF token
 **/
contract StakedAgfV1 is
  StakeToken /* VotingToken */
{
  string internal constant NAME = 'Staked AGF';
  string internal constant SYMBOL = 'stkAGF';
  uint8 internal constant DECIMALS = 18;

  uint256 public constant REVISION = 1;

  constructor(StakeTokenConfig memory params, address governance)
    public
    StakeToken(params, NAME, SYMBOL, DECIMALS)
  //    VotingToken(params, NAME, SYMBOL, DECIMALS)
  {
    governance;
  }

  function initialize(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external override initializer {
    if (getRevision() > 1) {
      return;
    }
    super._initialize(params, name, symbol, decimals);
  }

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }
}
