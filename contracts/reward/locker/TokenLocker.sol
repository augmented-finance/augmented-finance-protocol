// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {MarketAccessBitmask} from '../../access/MarketAccessBitmask.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {ForwardedRewardPool} from '../pools/ForwardedRewardPool.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

contract TokenLocker is IERC20, MarketAccessBitmask {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _underlyingToken;
  uint256 private _underlyingTotal;

  uint256 private _stakedTotal;
  mapping(uint32 => uint256) _pointTotal;

  uint32 private constant _maxDurationPoints = 255;
  uint32 private _maxValuePeriod; // = 208 weeks; // 4 * 52, must be less than _maxDurationPoints
  uint32 private _pointPeriod;
  uint32 private _nextKnownPoint;
  uint32 private _lastUpdateTS;

  bool private _updateEntered;
  bool private _paused;

  struct UserBalance {
    uint224 underlyingAmount;
    uint32 startTS;
    uint224 stakeAmount;
    uint32 endPoint;
  }

  mapping(address => UserBalance) private _balances;

  event Locked(address from, address to, uint256 underlyingAmount, uint256 amount, uint32 expiry);
  event Redeemed(address from, address to, uint256 underlyingAmount);

  constructor(
    IMarketAccessController accessCtl,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) public MarketAccessBitmask(accessCtl) {
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

  function lock(uint256 underlyingAmount, uint32 duration) external returns (uint256) {
    require(duration >= _pointPeriod);
    internalLock(msg.sender, msg.sender, underlyingAmount, duration, true);
  }

  function lockAdd(address to, uint256 underlyingAmount) external returns (uint256) {
    internalLock(msg.sender, to, underlyingAmount, 0, true);
  }

  function internalLock(
    address from,
    address to,
    uint256 underlyingAmount,
    uint32 duration,
    bool transferFrom
  ) internal returns (uint256 stakeAmount) {
    require(from != address(0));
    require(to != address(0));
    require(underlyingAmount > 0);

    uint32 currentPoint = internalUpdate(true, true);

    uint32 endPoint = pointOfTS(uint32(block.timestamp + duration));
    require(endPoint <= currentPoint + _maxDurationPoints);

    if (transferFrom) {
      _underlyingToken.safeTransferFrom(from, address(this), underlyingAmount);
    }

    UserBalance memory userBalance = _balances[to];

    _underlyingTotal = _underlyingTotal.add(underlyingAmount);
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
      require(duration > 0, 'NOTHING_LOCKED');
      userBalance.endPoint = endPoint;
    }
    userBalance.startTS = uint32(block.timestamp);

    require(underlyingAmount <= type(uint224).max);
    userBalance.underlyingAmount = uint224(underlyingAmount);

    uint256 adjDuration = uint256(endPoint * _pointPeriod).sub(userBalance.startTS);
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

    if (_nextKnownPoint > userBalance.endPoint || _nextKnownPoint == 0) {
      _nextKnownPoint = userBalance.endPoint;
    }

    _balances[to] = userBalance;

    emit Locked(
      from,
      to,
      underlyingAmount,
      userBalance.stakeAmount,
      userBalance.endPoint * _pointPeriod
    );
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

    // uint32 tsDelta = endPointTS - uint32(block.timestamp);
    // if (tsDelta == 0) {
    //   return userBalance.stakeAmount;
    // }

    // uint256 balanceDecay = uint256(userBalance.stakeAmount).mul(tsDelta).
    //   div(userBalance.endPoint * _pointPeriod - userBalance.startTS);

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

    _underlyingTotal = _underlyingTotal.sub(userBalance.underlyingAmount);
    _underlyingToken.safeTransfer(to, userBalance.underlyingAmount);

    emit Redeemed(from, to, userBalance.underlyingAmount);
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
    if (currentPoint < _nextKnownPoint || _nextKnownPoint == 0 || _lastUpdateTS == 0) {
      return (0, 0, 0);
    }

    fromPoint = _nextKnownPoint;
    maxPoint = pointOfTS(_lastUpdateTS) + _maxDurationPoints;

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
    (uint32 fromPoint, uint32 tillPoint, ) = getScanRange(pointOfTS(uint32(block.timestamp)));

    if (tillPoint == 0) {
      return 0;
    }

    totalSupply_ = _stakedTotal;

    for (; fromPoint <= tillPoint; fromPoint++) {
      uint256 pointTotal = _pointTotal[fromPoint];
      if (pointTotal == 0) {
        continue;
      }
      if (totalSupply_ == pointTotal) {
        return 0;
      }
      totalSupply_ = totalSupply_.sub(pointTotal);
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

  function internalUpdate(bool updateTS, bool preventReentry)
    private
    returns (uint32 currentPoint)
  {
    currentPoint = pointOfTS(uint32(block.timestamp));

    if (_updateEntered) {
      require(!preventReentry, 're-entry to stake or to redeem');
      return currentPoint;
    }
    if (_lastUpdateTS == block.timestamp) {
      return currentPoint;
    }

    (uint32 fromPoint, uint32 tillPoint, uint32 maxPoint) = getScanRange(currentPoint);

    if (updateTS) {
      _lastUpdateTS = uint32(block.timestamp);
    }

    if (tillPoint == 0) {
      return currentPoint;
    }

    _updateEntered = true;
    {
      walkPoints(fromPoint, tillPoint, maxPoint);
    }
    _updateEntered = false;

    return currentPoint;
  }

  function walkPoints(
    uint32 nextPoint,
    uint32 tillPoint,
    uint32 maxPoint
  ) private {
    uint256 stakedTotal = _stakedTotal;
    uint256 pointTotal = _pointTotal[nextPoint];

    for (; nextPoint <= tillPoint; ) {
      uint256 totalAfter = stakedTotal.sub(pointTotal);
      pointTotal = 0;

      if (totalAfter == 0) {
        // no more points
        nextPoint = 0;
        break;
      }

      // look for the next non-zero point
      for (nextPoint++; nextPoint <= maxPoint; nextPoint++) {
        pointTotal = _pointTotal[nextPoint];
        if (pointTotal > 0) {
          break;
        }
      }

      if (pointTotal == 0) {
        // reached the limit
        nextPoint = 0;
        break;
      }

      stakedTotal = totalAfter;
    }

    _nextKnownPoint = nextPoint;
    _stakedTotal = stakedTotal;
  }

  modifier notPaused() {
    require(!_paused);
    _;
  }

  function isRedeemable() external view returns (bool) {
    return !_paused;
  }

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
    revert('NOT_SUPPORTED');
  }

  function allowance(address, address) external view override returns (uint256) {
    revert('NOT_SUPPORTED');
  }

  function approve(address, uint256) external override returns (bool) {
    revert('NOT_SUPPORTED');
  }

  function transferFrom(
    address,
    address,
    uint256
  ) external override returns (bool) {
    revert('NOT_SUPPORTED');
  }
}