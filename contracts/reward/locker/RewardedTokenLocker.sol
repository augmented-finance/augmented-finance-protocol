// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {TokenLocker} from './TokenLocker.sol';
import {ForwardedRewardPool} from '../pools/ForwardedRewardPool.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

abstract contract RewardedTokenLocker is TokenLocker, ForwardedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  constructor(
    IMarketAccessController accessCtl,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) public TokenLocker(accessCtl, pointPeriod, maxValuePeriod) {}

  function calcReward(address holder)
    external
    view
    override
    returns (uint256 amount, uint32 since)
  {}

  function getRewardRate() external view override returns (uint256) {}

  function internalClaimReward(address holder)
    internal
    override
    returns (uint256 amount, uint32 since)
  {}

  function internalSetRewardRate(uint256 rate) internal override {}
}
