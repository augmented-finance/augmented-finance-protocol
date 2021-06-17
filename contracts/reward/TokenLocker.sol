// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ERC20WithPermit} from '../misc/ERC20WithPermit.sol';

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../tools/math/PercentageMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';

import {IBalanceHook} from '../interfaces/IBalanceHook.sol';

import {AccessFlags} from '../access/AccessFlags.sol';
import {MarketAccessBitmask} from '../access/MarketAccessBitmask.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';

import {Errors} from '../tools/Errors.sol';

import 'hardhat/console.sol';

abstract contract TokenLocker is
  IERC20,
  // ERC20WithPermit,
  MarketAccessBitmask
{
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _underlyingToken;
  uint256 private _underlyingTotal; // TODO

  //  IBalanceHook internal _incentivesController;

  uint256 private _stakedTotal;
  mapping(uint32 => uint256) _pointTotal;

  uint32 private constant _maxDurationPoints = 255;
  uint32 private _maxValuePeriod; // = 208 weeks; // 4 * 52, must be less than _maxDurationPoints
  uint32 private _pointPeriod;
  uint32 private _earliestKnownPoint;
  uint32 private _lastPointTS;

  bool private _updateEntered;
  bool private _paused;

  struct UserBalance {
    uint224 underlyingAmount;
    uint224 stakeAmount;
    uint32 startPoint;
    uint32 endPoint;
  }

  mapping(address => UserBalance) private _balances;

  event Staked(address from, address to, uint256 amount);
  event Redeem(address from, address to, uint256 amount, uint256 underlyingAmount);

  constructor(uint32 pointPeriod, uint32 maxValuePeriod) public {
    require(pointPeriod > 0, 'invalid pointPeriod');
    require(maxValuePeriod > pointPeriod, 'invalid maxValuePeriod');
    require(maxValuePeriod < pointPeriod * _maxDurationPoints, 'invalid maxValuePeriod');

    _pointPeriod = pointPeriod;
    _maxValuePeriod = maxValuePeriod;
  }

  function UNDERLYING_ASSET_ADDRESS() external view returns (address) {
    return address(_underlyingToken);
  }

  function pointOfTS(uint32 ts) private view returns (uint32) {
    return uint32(ts / _pointPeriod);
  }

  function lock(
    address to,
    uint256 underlyingAmount,
    uint32 duration
  ) external returns (uint256) {
    internalStake(msg.sender, to, underlyingAmount, duration, true);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    uint32 duration,
    bool transferFrom
  ) internal returns (uint256 stakeAmount) {
    require(to != address(0));
    require(underlyingAmount > 0);
    require(duration >= _pointPeriod);

    uint32 endPoint = pointOfTS(uint32(block.timestamp + duration));

    uint32 currentPoint = internalUpdate(true, true);
    require(endPoint <= currentPoint + _maxDurationPoints);

    if (transferFrom) {
      _underlyingToken.safeTransferFrom(from, address(this), underlyingAmount);
    }

    UserBalance memory userBalance = _balances[to];
    uint256 oldBalance = userBalance.stakeAmount;

    underlyingAmount = underlyingAmount.add(userBalance.underlyingAmount);

    if (userBalance.endPoint > currentPoint) {
      _stakedTotal = _stakedTotal.sub(userBalance.stakeAmount);
      _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].sub(
        userBalance.stakeAmount
      );

      if (userBalance.endPoint < endPoint) {
        userBalance.endPoint = endPoint;
      }
    } else {
      userBalance.endPoint = endPoint;
    }
    // TODO stakeAmount correction when timestamp != startPoint*_pointPeriod
    userBalance.startPoint = currentPoint;

    require(underlyingAmount <= type(uint224).max);
    userBalance.underlyingAmount = uint224(underlyingAmount);

    uint256 adjDuration = uint256(endPoint * _pointPeriod).sub(block.timestamp);
    if (adjDuration < _maxValuePeriod) {
      stakeAmount = underlyingAmount.mul(adjDuration).div(_maxValuePeriod);
    } else {
      stakeAmount = underlyingAmount;
    }

    require(stakeAmount <= type(uint224).max);
    userBalance.stakeAmount = uint224(stakeAmount);

    _stakedTotal = _stakedTotal.add(userBalance.stakeAmount);
    _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].add(
      userBalance.stakeAmount
    );

    if (_earliestKnownPoint > userBalance.endPoint || _earliestKnownPoint == 0) {
      _earliestKnownPoint = userBalance.endPoint;
    }

    _balances[to] = userBalance;

    // if (address(_incentivesController) != address(0)) {
    //   _incentivesController.handleBalanceUpdate(
    //     address(this),
    //     to,
    //     oldBalance,
    //     userBalance.stakeAmount,
    //     _stakedTotal
    //   );
    // }

    emit Staked(from, to, underlyingAmount);
    return userBalance.stakeAmount;
  }

  function balanceOf(address account) external view override returns (uint256) {
    UserBalance memory userBalance = _balances[account];
    if (userBalance.stakeAmount == 0) {
      return 0;
    }

    uint32 endPointTS = userBalance.endPoint * _pointPeriod;
    if (endPointTS <= block.timestamp) {
      return 0;
    }
    return userBalance.stakeAmount;

    // uint256 balanceDecay = uint256(userBalance.stakeAmount).mul(endPointTS - block.timestamp).
    //   div((userBalance.endPoint - userBalance.startPoint) * _pointPeriod);

    // if (balanceDecay >= userBalance.stakeAmount) {
    //   return 0;
    // }
    // return uint256(userBalance.stakeAmount).sub(balanceDecay);
  }

  function balanceOfUnderlying(address account) external view returns (uint256) {
    return _balances[account].underlyingAmount;
  }

  function balanceOfUnderlyingAndExpiry(address account)
    external
    view
    returns (uint256 underlying, uint32 availableSince)
  {
    underlying = _balances[account].underlyingAmount;
    if (underlying == 0) {
      return (0, 0);
    }
    return (underlying, _balances[account].endPoint * _pointPeriod);
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   **/
  function redeem(address to) external notPaused returns (uint256 underlyingAmount) {
    return internalRedeem(msg.sender, to);
  }

  function internalRedeem(address from, address to) private returns (uint256 underlyingAmount) {
    uint32 currentPoint = internalUpdate(false, true);
    UserBalance memory userBalance = _balances[from];

    if (userBalance.underlyingAmount == 0 || userBalance.endPoint > currentPoint) {
      return 0;
    }

    delete (_balances[from]);

    _underlyingToken.safeTransfer(to, userBalance.underlyingAmount);
    return userBalance.underlyingAmount;
  }

  function update() public {
    internalUpdate(false, false);
  }

  function getScanRange(uint32 currentPoint)
    private
    view
    returns (
      uint32 fromPoint,
      uint32 tillPoint,
      uint32 maxPoint
    )
  {
    if (currentPoint < _earliestKnownPoint || _earliestKnownPoint == 0 || _lastPointTS == 0) {
      return (0, 0, 0);
    }

    fromPoint = _earliestKnownPoint;
    maxPoint = pointOfTS(_lastPointTS) + _maxDurationPoints;

    if (maxPoint > currentPoint) {
      tillPoint = currentPoint;
    } else {
      tillPoint = maxPoint;
    }

    return (fromPoint, tillPoint, maxPoint);
  }

  function totalOfUnderlying() external view returns (uint256) {
    return _underlyingTotal;
  }

  function totalSupply() external view override returns (uint256 totalSupply_) {
    uint32 currentPoint = pointOfTS(uint32(block.timestamp));
    (uint32 fromPoint, uint32 tillPoint, uint32 maxPoint) = getScanRange(currentPoint);

    if (tillPoint == 0) {
      return 0;
    }

    totalSupply_ = _stakedTotal;

    uint32 lastPoint;
    uint256 pointTotal;

    for (; fromPoint <= tillPoint; fromPoint++) {
      pointTotal = _pointTotal[fromPoint];
      if (pointTotal > 0) {
        totalSupply_ = totalSupply_.sub(pointTotal);
        lastPoint = fromPoint;
      }
    }

    return totalSupply_;

    // if (totalSupply_ == 0) {
    //   return 0;
    // }

    // for (tillPoint = currentPoint + 1; tillPoint <= maxPoint; tillPoint++) {
    //   pointTotal = _pointTotal[tillPoint];
    //   if (pointTotal > 0) {
    //     break;
    //   }
    // }

    // if (pointTotal == 0) {
    //   return 0;
    // }

    // uint256 totalDecay = pointTotal.mul((tillPoint - lastPoint)*_pointPeriod).div(tillPoint*_pointPeriod - block.timestamp);
    // if (totalDecay >= totalSupply_) {
    //   return 0;
    // }
    // return totalSupply_.sub(totalDecay);
  }

  function internalUpdate(bool newStake, bool preventReentry)
    private
    returns (uint32 currentPoint)
  {
    currentPoint = pointOfTS(uint32(block.timestamp));

    if (_updateEntered) {
      require(!preventReentry, 're-entry to stake or to redeem');
      return currentPoint;
    }
    if (_lastPointTS == block.timestamp) {
      return currentPoint;
    }

    (uint32 fromPoint, uint32 tillPoint, ) = getScanRange(currentPoint);

    if (newStake) {
      _lastPointTS = uint32(block.timestamp);
    }

    if (tillPoint == 0) {
      return currentPoint;
    }

    _updateEntered = true;
    {
      _earliestKnownPoint = 0;

      internalUpdateCallOnce(currentPoint, fromPoint, tillPoint);
      //    internalUpdateCallEach(fromPoint, tillPoint);
    }
    _updateEntered = false;

    return currentPoint;
  }

  function internalUpdateCallOnce(
    uint32 currentPoint,
    uint32 fromPoint,
    uint32 tillPoint
  ) private {
    // uint256 totalBefore = _stakedTotal;
    uint256 stakedTotal = _stakedTotal;

    for (; fromPoint <= tillPoint; fromPoint++) {
      // TODO _pointDecay[fromPoint] = ...;
      uint256 pointTotal = _pointTotal[fromPoint];
      if (pointTotal == 0) {
        continue;
      }
      delete (_pointTotal[fromPoint]);
      stakedTotal = stakedTotal.sub(pointTotal);
    }
    _stakedTotal = stakedTotal;

    if (stakedTotal > 0) {
      _earliestKnownPoint = _findEarliestKnownPoint(currentPoint);
    }

    // if (address(_incentivesController) != address(0)) {
    //   _incentivesController.handleBalanceUpdate(address(this), address(0), 0, 0, stakedTotal);
    // }
  }

  function internalUpdateCallEach(uint32 fromPoint, uint32 tillPoint) private {
    for (; fromPoint <= tillPoint; fromPoint++) {
      uint256 pointTotal = _pointTotal[fromPoint];
      if (pointTotal == 0) {
        continue;
      }
      delete (_pointTotal[fromPoint]);
      uint256 totalBefore = _stakedTotal;
      uint256 totalAfter = totalBefore.sub(pointTotal);
      _stakedTotal = totalAfter;

      // if (stakedTotal > 0) {
      //   // _earliestKnownPoint is the next point
      //   _earliestKnownPoint = _findEarliestKnownPoint(currentPoint);
      // }

      // uint256 blockNumber =
      //   leftmostBlock +
      //     ((block.number - leftmostBlock) * (point - leftmostPoint)) /
      //     (currentPoint - leftmostPoint);

      // if (address(_incentivesController) != address(0)) {
      //   _incentivesController.handleBalanceUpdate(
      //     address(this),
      //     address(0),
      //     0,
      //     0,
      //     totalAfter
      //   );
      // }
    }
  }

  function _findEarliestKnownPoint(uint32 currentPoint) private view returns (uint32) {
    uint32 tillPoint = currentPoint + _maxDurationPoints;
    for (currentPoint++; currentPoint <= tillPoint; currentPoint++) {
      if (_pointTotal[currentPoint] > 0) {
        return currentPoint;
      }
    }
    revert('inconsistent total');
  }

  modifier notPaused() {
    require(!_paused);
    _;
  }

  function isRedeemable() external view returns (bool) {
    return !_paused;
  }

  // function setRedeemable(bool redeemable)
  //   external
  //   override
  //   aclHas(AccessFlags.LIQUIDITY_CONTROLLER)
  // {
  //   _paused = !redeemable;
  // }

  function setPaused(bool paused) external onlyEmergencyAdmin {
    _paused = paused;
  }

  function isPaused() external view returns (bool) {
    return _paused;
  }

  function getUnderlying() internal view returns (address) {
    return address(_underlyingToken);
  }

  function transfer(address, uint256) external override returns (bool) {
    revert('not allowed');
  }

  function allowance(address, address) external view override returns (uint256) {
    revert('not allowed');
  }

  function approve(address, uint256) external override returns (bool) {
    revert('not allowed');
  }

  function transferFrom(
    address,
    address,
    uint256
  ) external override returns (bool) {
    revert('not allowed');
  }
}
