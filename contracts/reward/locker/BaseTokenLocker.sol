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
import {CalcLinearRateReward} from '../calcs/CalcLinearRateReward.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

abstract contract BaseTokenLocker is IERC20, MarketAccessBitmask {
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
  // uint32 private _lastKnownPoint;
  uint32 private _updateTS;

  bool private _updateEntered;
  bool private _paused;

  struct UserBalance {
    uint224 underlyingAmount;
    uint32 endPoint;
  }

  mapping(address => UserBalance) private _balances;
  mapping(address => mapping(address => bool)) private _allowAdd;

  event Locked(
    address from,
    address indexed to,
    uint256 underlyingAmount,
    uint256 amount,
    uint32 indexed expiry,
    uint64 indexed referal
  );
  event Redeemed(address indexed from, address indexed to, uint256 underlyingAmount);

  constructor(
    IMarketAccessController accessCtl,
    address underlying,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) public MarketAccessBitmask(accessCtl) {
    _initialize(underlying, pointPeriod, maxValuePeriod);
  }

  function _initialize(
    address underlying,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) internal {
    require(pointPeriod > 0, 'invalid pointPeriod');
    require(maxValuePeriod > pointPeriod, 'invalid maxValuePeriod');
    require(maxValuePeriod < pointPeriod * _maxDurationPoints, 'invalid maxValuePeriod');

    _underlyingToken = IERC20(underlying);
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
    uint256 underlyingAmount,
    uint32 duration,
    uint64 referal
  ) external returns (uint256) {
    require(duration >= _pointPeriod);
    internalLock(msg.sender, msg.sender, underlyingAmount, duration, referal);
  }

  function allowAdd(address to, bool allow) external {
    _allowAdd[msg.sender][to] = allow;
  }

  function lockAdd(address to, uint256 underlyingAmount) external returns (uint256) {
    require(_allowAdd[to][msg.sender], 'ADD_TO_LOCK_RESTRICTED');
    internalLock(msg.sender, to, underlyingAmount, 0, 0);
  }

  function internalLock(
    address from,
    address to,
    uint256 underlyingAmount,
    uint32 duration,
    uint64 referal
  ) internal returns (uint256 stakeAmount) {
    require(from != address(0));
    require(to != address(0));
    require(underlyingAmount > 0);

    uint32 currentPoint = internalUpdate(true, true);

    _underlyingToken.safeTransferFrom(from, address(this), underlyingAmount);

    UserBalance memory userBalance = _balances[to];

    {
      uint32 endPoint = pointOfTS(uint32(block.timestamp + duration + (_pointPeriod >> 1)));
      require(endPoint <= currentPoint + _maxDurationPoints);

      (stakeAmount, ) = getStakeBalance(to);

      _underlyingTotal = _underlyingTotal.add(underlyingAmount);
      underlyingAmount = underlyingAmount.add(userBalance.underlyingAmount);

      if (userBalance.endPoint > currentPoint) {
        _stakedTotal = _stakedTotal.sub(stakeAmount);
        _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].sub(stakeAmount);

        if (userBalance.endPoint < endPoint) {
          userBalance.endPoint = endPoint;
        }
      } else {
        require(duration > 0, 'NOTHING_IS_LOCKED');
        userBalance.endPoint = endPoint;
      }
    }

    require(underlyingAmount <= type(uint224).max);
    userBalance.underlyingAmount = uint224(underlyingAmount);

    uint256 adjDuration = uint256(userBalance.endPoint * _pointPeriod).sub(block.timestamp);
    console.log('internalLock', underlyingAmount, adjDuration, _maxValuePeriod);
    if (adjDuration < _maxValuePeriod) {
      stakeAmount = underlyingAmount.mul(adjDuration).div(_maxValuePeriod);
    } else {
      stakeAmount = underlyingAmount;
    }
    require(stakeAmount <= type(uint224).max);

    _stakedTotal = _stakedTotal.add(stakeAmount);
    _pointTotal[userBalance.endPoint] = _pointTotal[userBalance.endPoint].add(stakeAmount);

    if (_nextKnownPoint > userBalance.endPoint || _nextKnownPoint == 0) {
      _nextKnownPoint = userBalance.endPoint;
    }

    // if (_lastKnownPoint < userBalance.endPoint || _lastKnownPoint == 0) {
    //   _lastKnownPoint = userBalance.endPoint;
    // }

    _balances[to] = userBalance;
    setStakeBalance(to, uint224(stakeAmount));

    emit Locked(
      from,
      to,
      underlyingAmount,
      stakeAmount,
      userBalance.endPoint * _pointPeriod,
      referal
    );
    return stakeAmount;
  }

  function balanceOf(address account) external view override returns (uint256 stakeAmount) {
    (stakeAmount, ) = getStakeBalance(account);
    if (stakeAmount == 0) {
      return 0;
    }

    uint32 endPointTS = _balances[account].endPoint * _pointPeriod;
    if (endPointTS <= block.timestamp) {
      return 0;
    }

    return stakeAmount;

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

  function expiryOf(address account) internal view returns (uint32 availableSince) {
    return _balances[account].endPoint * _pointPeriod;
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
    fromPoint = _nextKnownPoint;

    if (currentPoint < fromPoint || fromPoint == 0) {
      return (fromPoint, 0, 0);
    }

    maxPoint = pointOfTS(_updateTS) + _maxDurationPoints;
    // if (_lastKnownPoint > 0) {
    //   maxPoint = _lastKnownPoint;
    // }

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

    totalSupply_ = _stakedTotal;

    console.log('totalSupply', fromPoint, tillPoint, totalSupply_);

    if (tillPoint == 0) {
      return totalSupply_;
    }

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
    internal
    returns (uint32 currentPoint)
  {
    currentPoint = pointOfTS(uint32(block.timestamp));

    if (_updateEntered) {
      require(!preventReentry, 're-entry to stake or to redeem');
      return currentPoint;
    }
    if (_updateTS == block.timestamp) {
      return currentPoint;
    }

    (uint32 fromPoint, uint32 tillPoint, uint32 maxPoint) = getScanRange(currentPoint);

    if (updateTS) {
      _updateTS = uint32(block.timestamp);
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
      if (pointTotal > 0) {
        uint256 totalBefore = stakedTotal;
        stakedTotal = stakedTotal.sub(pointTotal);
        internalUpdateTotal(totalBefore, stakedTotal, nextPoint * _pointPeriod);
        pointTotal = 0;
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
    }

    _nextKnownPoint = nextPoint;
    // if (nextPoint == 0 || nextPoint > _lastKnownPoint) {
    //   _lastKnownPoint = nextPoint;
    // }
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

  function setStakeBalance(address holder, uint224 stakeAmount) internal virtual;

  function getStakeBalance(address holder)
    internal
    view
    virtual
    returns (uint224 stakeAmount, uint32 startTS);

  function internalUpdateTotal(
    uint256 totalBefore,
    uint256 totalAfter,
    uint32 at
  ) internal virtual;
}
