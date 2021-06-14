// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ERC20WithPermit} from '../../misc/ERC20WithPermit.sol';

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IStakeToken, IManagedStakeToken} from './interfaces/IStakeToken.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';

import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {MarketAccessBitmask} from '../../access/MarketAccessBitmask.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

abstract contract TimeWeightedStakeTokenBase is
  IManagedStakeToken,
  ERC20WithPermit,
  MarketAccessBitmask
{
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _stakedToken;
  IBalanceHook internal _incentivesController;

  uint256 private _stakedTotal;
  mapping(uint32 => uint256) _pointTotal;

  uint256 private _knownPointsMask;
  uint32 private _pointPeriod;
  uint32 private _earliestKnownPoint;
  uint32 private _lastUpdatePoint;
  uint32 private _lastUpdateBlock;

  bool private _redeemPaused;

  struct UserBalance {
    uint224 underlyingAmount;
    uint32 startPoint;
    uint224 stakeAmount;
    uint32 endPoint;
  }

  mapping(address => UserBalance) private _balances;

  event Staked(address from, address to, uint256 amount);
  event Redeem(address from, address to, uint256 amount, uint256 underlyingAmount);

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals,
    uint32 pointPeriod
  ) public ERC20WithPermit(name, symbol, decimals) {
    require(pointPeriod > 0, 'invalid pointPeriod');
    _pointPeriod = pointPeriod;
  }

  function UNDERLYING_ASSET_ADDRESS() external view returns (address) {
    return address(_stakedToken);
  }

  function stake(
    address to,
    uint256 underlyingAmount,
    uint32 duration
  ) external returns (uint256) {
    internalStake(msg.sender, to, underlyingAmount, duration, true);
  }

  uint32 private constant _maxDurationPoints = 255;

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    uint32 duration,
    bool transferFrom
  ) internal returns (uint256 stakeAmount) {
    require(to != address(0));
    require(underlyingAmount > 0);
    require(duration > 0);
    duration = (duration + _pointPeriod - 1) / _pointPeriod;
    require(duration <= _maxDurationPoints);

    uint32 currentPoint = uint32((block.timestamp + _pointPeriod - 1) / _pointPeriod);
    updateEarliestPoint(currentPoint);

    if (transferFrom) {
      _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);
    }

    UserBalance memory userBalance = _balances[to];

    if (userBalance.endPoint >= _earliestKnownPoint) {
      _stakedTotal = _stakedTotal.sub(userBalance.stakeAmount);
      _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].sub(
        userBalance.stakeAmount
      );
    }

    underlyingAmount = underlyingAmount.add(userBalance.underlyingAmount);
    require(underlyingAmount <= type(uint224).max);

    userBalance.underlyingAmount = uint224(underlyingAmount);
    if (duration < _maxDurationPoints) {
      userBalance.stakeAmount = uint224(underlyingAmount.mul(duration).div(_maxDurationPoints));
    } else {
      userBalance.stakeAmount = uint224(underlyingAmount);
    }
    userBalance.startPoint = currentPoint;
    userBalance.endPoint += duration;
    require(userBalance.startPoint < userBalance.endPoint);

    _knownPointsMask |= uint256(1) << duration;

    _stakedTotal = _stakedTotal.add(userBalance.stakeAmount);
    _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].add(
      userBalance.stakeAmount
    );

    if (_earliestKnownPoint > userBalance.endPoint) {
      _earliestKnownPoint = userBalance.endPoint;
    }

    _balances[to] = userBalance;

    // if (address(_incentivesController) != address(0)) {
    //   _incentivesController.handleBalanceUpdate(
    //     address(this),
    //     to,
    //     oldReceiverBalance,
    //     balanceOf(to),
    //     totalSupply()
    //   );
    // }

    emit Staked(from, to, underlyingAmount);
    return userBalance.stakeAmount;
  }

  function updateEarliestPoint(uint32 currentPoint) private {
    if (_lastUpdatePoint == currentPoint) {
      return;
    }
    uint256 pointsPassed = uint256(currentPoint).sub(_lastUpdatePoint);
    uint256 maskPassed = _knownPointsMask;

    (uint32 lastUpdatePoint, uint32 lastUpdateBlock) = (_lastUpdatePoint, _lastUpdateBlock);
    (_lastUpdatePoint, _lastUpdateBlock) = (currentPoint, uint32(block.number));

    if (pointsPassed > 255) {
      _knownPointsMask = 0;
      _earliestKnownPoint = 0;
    } else {
      _knownPointsMask = maskPassed >> pointsPassed;
      maskPassed &= (1 << pointsPassed) - 1;
      _earliestKnownPoint = findEarliestKnownPoint();
    }

    walkPoints(lastUpdatePoint, lastUpdateBlock, currentPoint, maskPassed);
  }

  function walkPoints(
    uint32 leftmostPoint,
    uint32 leftmostBlock,
    uint32 currentPoint,
    uint256 mask
  ) private {
    for (uint32 point = leftmostPoint; mask != 0; (mask, point) = (mask >> 1, point + 1)) {
      if (mask & 1 == 0) {
        continue;
      }
      uint256 pointTotal = _pointTotal[point];
      if (pointTotal == 0) {
        continue;
      }
      delete (_pointTotal[point]);
      uint256 totalBefore = _stakedTotal;
      uint256 totalAfter = totalBefore.sub(pointTotal);
      _stakedTotal = totalAfter;

      uint256 blockNumber =
        leftmostBlock +
          ((block.number - leftmostBlock) * (point - leftmostPoint)) /
          (currentPoint - leftmostPoint);
      updateTotalSlope(uint32(blockNumber), totalBefore, totalAfter);
    }
  }

  function updateTotalSlope(
    uint32 blockNumber,
    uint256 totalBefore,
    uint256 totalAfter
  ) private {}

  function findEarliestKnownPoint() private view returns (uint32) {}

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param stakeAmount Amount of stake to redeem
   **/
  function redeem(address to)
    external
    returns (
      //    override
      uint256 stakeAmount
    )
  {
    // require(stakeAmount > 0, Errors.VL_INVALID_AMOUNT);
    // (stakeAmount_, ) = internalRedeem(msg.sender, to, stakeAmount, 0);
    // return stakeAmount_;
  }

  function isRedeemable() external view returns (bool) {
    return !_redeemPaused;
  }

  function setRedeemable(bool redeemable)
    external
    override
    aclHas(AccessFlags.LIQUIDITY_CONTROLLER)
  {
    _redeemPaused = !redeemable;
  }

  function setPaused(bool paused) external override onlyEmergencyAdmin {
    _redeemPaused = paused;
  }

  function isPaused() external view override returns (bool) {
    return _redeemPaused;
  }

  function getUnderlying() internal view returns (address) {
    return address(_stakedToken);
  }

  /**
   * @dev Internal ERC20 _transfer of the tokenized staked tokens
   * @param from Address to transfer from
   * @param to Address to transfer to
   * @param amount Amount to transfer
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    super._transfer(from, to, amount);
  }
}
