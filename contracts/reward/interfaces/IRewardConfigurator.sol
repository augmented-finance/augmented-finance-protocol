// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

interface IRewardConfigurator {
  struct PoolInitData {
    address provider;
    address impl;
    uint256 initialRate;
    uint224 rateScale;
    uint16 baselinePercentage;
  }

  struct PoolUpdateData {
    address pool;
  }

  function batchInitRewardPools(PoolInitData[] calldata entries) external;
}
