// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../reward/pools/TreasuryRewardPool.sol';

contract MockTreasuryRewardPool is TreasuryRewardPool {
  address private _t;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    address treasury
  ) TreasuryRewardPool(controller, initialRate, baselinePercentage) {
    _t = treasury;
  }

  function getTreasury() internal view override returns (address) {
    return _t;
  }
}
