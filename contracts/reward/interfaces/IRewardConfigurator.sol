// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

interface IRewardConfigurator {
  struct StakeInitData {
    address stakeTokenImpl;
    address stakedToken;
    string stkTokenName;
    string stkTokenSymbol;
    uint8 stkTokenDecimals;
  }
}
