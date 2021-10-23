// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './StakeTokenConfig.sol';

interface IStakeConfigurator {
  struct InitStakeTokenData {
    address stakeTokenImpl;
    address stakedToken;
    address strategy;
    string stkTokenName;
    string stkTokenSymbol;
    uint32 cooldownPeriod;
    uint32 unstakePeriod;
    uint16 maxSlashable;
    uint8 stkTokenDecimals;
    bool depositStake;
  }

  struct UpdateStakeTokenData {
    address token;
    address stakeTokenImpl;
    string stkTokenName;
    string stkTokenSymbol;
  }

  struct StakeTokenData {
    address token;
    string stkTokenName;
    string stkTokenSymbol;
    StakeTokenConfig config;
  }

  event StakeTokenInitialized(address indexed token, InitStakeTokenData data);

  event StakeTokenUpgraded(address indexed token, UpdateStakeTokenData data);

  event StakeTokenAdded(address indexed token, address indexed underlying);

  event StakeTokenRemoved(address indexed token, address indexed underlying);

  function list() external view returns (address[] memory tokens);

  function listAll() external view returns (address[] memory tokens, uint256 genCount);

  function dataOf(address stakeToken) external view returns (StakeTokenData memory data);

  function stakeTokenOf(address underlying) external view returns (address);

  function setCooldownForAll(uint32 cooldownPeriod, uint32 unstakePeriod) external;
}
