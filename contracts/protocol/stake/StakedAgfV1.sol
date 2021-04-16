// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {VotingToken} from './VotingToken.sol';
import {StakeToken} from './StakeToken.sol';
import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

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

  constructor(
    IERC20 stakedToken,
    IBalanceHook incentivesController,
    uint256 cooldownSeconds,
    uint256 unstakeWindow,
    address governance
  )
    public
    StakeToken(
      //    VotingToken(
      stakedToken,
      incentivesController,
      cooldownSeconds,
      unstakeWindow,
      NAME,
      SYMBOL,
      DECIMALS
      //      governance
    )
  {}

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }
}
