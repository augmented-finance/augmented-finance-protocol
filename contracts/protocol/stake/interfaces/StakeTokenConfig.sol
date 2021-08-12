// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../access/interfaces/IMarketAccessController.sol';

struct StakeTokenConfig {
  IMarketAccessController stakeController;
  IERC20 stakedToken;
  uint32 cooldownPeriod;
  uint32 unstakePeriod;
  uint16 maxSlashable;
}
