// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {StakeTokenConfig} from './StakeTokenConfig.sol';

interface IStakeConfigurator {
  struct InitStakeTokenData {
    address stakeTokenImpl;
    address stakedToken;
    string stkTokenName;
    string stkTokenSymbol;
    uint32 cooldownPeriod;
    uint32 unstakePeriod;
    uint8 stkTokenDecimals;
  }

  struct UpdateStakeTokenData {
    address token;
    address stakeTokenImpl;
    string stkTokenName;
    string stkTokenSymbol;
    uint32 cooldownPeriod;
    uint32 unstakePeriod;
  }

  struct StakeTokenData {
    address token;
    string stkTokenName;
    string stkTokenSymbol;
    uint8 stkTokenDecimals;
    StakeTokenConfig config;
  }
}
