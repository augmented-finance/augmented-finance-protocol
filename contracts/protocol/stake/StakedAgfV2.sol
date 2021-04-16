// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {VotingToken} from './VotingToken.sol';
import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

/**
 * @title StakedAgfV2
 * @notice StakedTokenV2 with AAVE token as staked token
 * @author Aave
 **/
contract StakedAgfV2 is VotingToken {
  string internal constant NAME = 'Staked Aave';
  string internal constant SYMBOL = 'stkAAVE';
  uint8 internal constant DECIMALS = 18;

  constructor(
    IERC20 stakedToken,
    IBalanceHook incentivesController,
    uint256 cooldownSeconds,
    uint256 unstakeWindow,
    address rewardsVault,
    address emissionManager,
    uint128 distributionDuration,
    address governance
  )
    public
    VotingToken(
      stakedToken,
      incentivesController,
      cooldownSeconds,
      unstakeWindow,
      NAME,
      SYMBOL,
      DECIMALS,
      governance
    )
  {}
}
