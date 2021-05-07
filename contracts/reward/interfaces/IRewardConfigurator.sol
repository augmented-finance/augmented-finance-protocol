// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

interface IRewardConfigurator {
  struct StakeInitData {
    address stakeTokenImpl;
    address stakedToken;
    string stkTokenName;
    string stkTokenSymbol;
    uint32 cooldownBlocks;
    uint32 unstakeBlocks;
    uint16 maxSlashPct;
    uint8 stkTokenDecimals;
  }

  enum RewardType {NoReward, Token, StakeToken}
}
