// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IBalanceHook} from '../../../interfaces/IBalanceHook.sol';
import {IStakeAccessController} from './IStakeAccessController.sol';
import {ITransferHook} from './ITransferHook.sol';

struct StakeTokenConfig {
  IStakeAccessController stakeController;
  IERC20 stakedToken;
  IBalanceHook incentivesController;
  uint32 cooldownBlocks;
  uint32 unstakeBlocks;
  // For voting token only
  ITransferHook governance;
}
