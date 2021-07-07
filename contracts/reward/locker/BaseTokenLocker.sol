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

  struct Point {
    uint128 stakeDelta;
    uint128 rateDelta;
  }

  uint256 private _stakedTotal;
  uint256 private _extraRate;
  uint256 private _excessAccum;

  mapping(uint32 => Point) _pointTotal;

  uint32 private constant _maxDurationPoints = 255;
  uint32 private _maxValuePeriod; // = 208 weeks; // 4 * 52, must be less than _maxDurationPoints
  uint32 private _pointPeriod;
  uint32 private _nextKnownPoint;
  uint32 private _lastKnownPoint;
  uint32 private _lastUpdateTS;

  bool private _updateEntered;
  bool private _paused;

  struct UserBalance {
    uint192 underlyingAmount;
    uint32 startTS;
    uint32 endPoint;
  }

  mapping(address => UserBalance) private _balances;
  mapping(address => mapping(address => bool)) private _allowAdd;

  event Locked(
    address from,
    address indexed to,
    uint256 underlyingAmountAdded,
    uint256 underlyingAmountTotal,
    uint256 amount,
    uint32 indexed expiry,
    uint256 indexed referral
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

  function lock(
    uint256 underlyingAmount,
    uint32 duration,
    uint256 referral
  ) external returns (uint256) {
    require(underlyingAmount > 0, 'ZERO_UNDERLYING');
    //    require(duration > 0, 'ZERO_DURATION');

    (uint256 stakeAmount, uint256 recoverableError) =
      internalLock(msg.sender, msg.sender, underlyingAmount, duration, referral, true);

    revertOnError(recoverableError);
    return stakeAmount;
  }

  function lockExtend(uint32 duration) external returns (uint256) {
    require(duration > 0, 'ZERO_DURATION');

    (uint256 stakeAmount, uint256 recoverableError) =
      internalLock(msg.sender, msg.sender, 0, duration, 0, false);

    revertOnError(recoverableError);
    return stakeAmount;
  }

  function allowAdd(address to, bool allow) external {
    _allowAdd[msg.sender][to] = allow;
  }

  function lockAdd(address to, uint256 underlyingAmount) external returns (uint256) {
    require(underlyingAmount > 0, 'ZERO_UNDERLYING');
    require(_allowAdd[to][msg.sender], 'ADD_TO_LOCK_RESTRICTED');

    (uint256 stakeAmount, uint256 recoverableError) =
      internalLock(msg.sender, to, underlyingAmount, 0, 0, true);

    revertOnError(recoverableError);
    return stakeAmount;
  }

  uint256 private constant LOCK_ERR_NOTHING_IS_LOCKED = 1;
  uint256 private constant LOCK_ERR_DURATION_IS_TOO_LARGE = 2;
  uint256 private constant LOCK_ERR_UNDERLYING_OVERFLOW = 3;
  uint256 private constant LOCK_ERR_LOCK_OVERFLOW = 4;

  function revertOnError(uint256 recoverableError) private pure {
    require(recoverableError != LOCK_ERR_LOCK_OVERFLOW, 'LOCK_ERR_LOCK_OVERFLOW');
    require(recoverableError != LOCK_ERR_UNDERLYING_OVERFLOW, 'LOCK_ERR_UNDERLYING_OVERFLOW');
    require(recoverableError != LOCK_ERR_DURATION_IS_TOO_LARGE, 'LOCK_ERR_DURATION_IS_TOO_LARGE');
    require(recoverableError != LOCK_ERR_NOTHING_IS_LOCKED, 'NOTHING_IS_LOCKED');
    require(recoverableError == 0, 'UNKNOWN_RECOVERABLE_ERROR');
  }

  function internalLock(
    address from,
    address to,
    uint256 underlyingTransfer,
    uint32 duration,
    uint256 referral,
    bool transfer
  ) internal returns (uint256 stakeAmount, uint256 recoverableError) {
    require(from != address(0), 'ZERO_FROM');
    require(to != address(0), 'ZERO_TO');

    uint32 currentPoint = internalUpdate(true, 0);

    internalSyncRate(uint32(block.timestamp));

    UserBalance memory userBalance = _balances[to];
    userBalance.startTS = uint32(block.timestamp);

    {
      // ======== ATTN! DO NOT APPLY STATE CHANGES STARTING FROM HERE ========
      {
        // ATTN! Should be no overflow checks here
        uint256 underlyingBalance = underlyingTransfer + userBalance.underlyingAmount;

        if (underlyingBalance < underlyingTransfer || underlyingBalance > type(uint192).max) {
          return (0, LOCK_ERR_UNDERLYING_OVERFLOW);
        } else if (underlyingBalance == 0) {
          return (0, LOCK_ERR_NOTHING_IS_LOCKED);
        }
        userBalance.underlyingAmount = uint192(underlyingBalance);
      }

      uint32 newEndPoint;
      if (duration < _pointPeriod) {
        // at least 1 full week is required
        newEndPoint = 1 + (uint32(userBalance.startTS + _pointPeriod - 1) / _pointPeriod);
      } else {
        newEndPoint = uint32(userBalance.startTS + duration + (_pointPeriod >> 1)) / _pointPeriod;
      }

      if (newEndPoint > currentPoint + _maxDurationPoints) {
        return (0, LOCK_ERR_DURATION_IS_TOO_LARGE);
      }

      uint256 prevStake;
      if (userBalance.endPoint > currentPoint) {
        prevStake = getStakeBalance(to);

        if (userBalance.endPoint > newEndPoint) {
          newEndPoint = userBalance.endPoint;
        }
      } else if (duration == 0) {
        return (0, LOCK_ERR_NOTHING_IS_LOCKED);
      }

      {
        uint256 adjDuration = uint256(newEndPoint * _pointPeriod).sub(userBalance.startTS);
        if (adjDuration < _maxValuePeriod) {
          stakeAmount = uint256(userBalance.underlyingAmount).mul(adjDuration).div(_maxValuePeriod);
        } else {
          stakeAmount = userBalance.underlyingAmount;
        }
      }

      // ATTN! Should be no overflow checks here
      uint256 newStakeDelta = stakeAmount + _pointTotal[newEndPoint].stakeDelta;

      if (newStakeDelta < stakeAmount || newStakeDelta > type(uint128).max) {
        return (0, LOCK_ERR_LOCK_OVERFLOW);
      }

      // ======== ATTN! "DO NOT APPLY STATE CHANGES" ENDS HERE ========

      if (userBalance.endPoint <= currentPoint) {
        // sum up rewards for the previous balance
        unsetStakeBalance(to, userBalance.endPoint * _pointPeriod, true);
      }

      if (prevStake > 0) {
        if (userBalance.endPoint == newEndPoint) {
          newStakeDelta = newStakeDelta.sub(prevStake);
        } else {
          _pointTotal[userBalance.endPoint].stakeDelta = uint128(
            uint256(_pointTotal[userBalance.endPoint].stakeDelta).sub(prevStake)
          );
        }
        _stakedTotal = _stakedTotal.sub(prevStake);
      }

      userBalance.endPoint = newEndPoint;

      // range check is done above
      _pointTotal[newEndPoint].stakeDelta = uint128(newStakeDelta);
      _stakedTotal = _stakedTotal.add(stakeAmount);
    }

    if (transfer) {
      _underlyingToken.safeTransferFrom(from, address(this), underlyingTransfer);
    }

    if (_nextKnownPoint > userBalance.endPoint || _nextKnownPoint == 0) {
      _nextKnownPoint = userBalance.endPoint;
    }

    if (_lastKnownPoint < userBalance.endPoint || _lastKnownPoint == 0) {
      _lastKnownPoint = userBalance.endPoint;
    }

    setStakeBalance(to, uint224(stakeAmount));
    _balances[to] = userBalance;

    emit Locked(
      from,
      to,
      underlyingTransfer,
      userBalance.underlyingAmount,
      stakeAmount,
      userBalance.endPoint * _pointPeriod,
      referral
    );
    return (stakeAmount, 0);
  }

  function balanceOfUnderlying(address account) public view returns (uint256) {
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

  function expiryOf(address account)
    internal
    view
    returns (uint32 lockedSince, uint32 availableSince)
  {
    return (_balances[account].startTS, _balances[account].endPoint * _pointPeriod);
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   **/
  function redeem(address to) external notPaused returns (uint256 underlyingAmount) {
    return internalRedeem(msg.sender, to);
  }

  function internalRedeem(address from, address to) private returns (uint256 underlyingAmount) {
    uint32 currentPoint = internalUpdate(true, 0);
    UserBalance memory userBalance = _balances[from];

    if (userBalance.underlyingAmount == 0 || userBalance.endPoint > currentPoint) {
      return 0;
    }

    unsetStakeBalance(from, userBalance.endPoint * _pointPeriod, false);

    delete (_balances[from]);

    _underlyingToken.safeTransfer(to, userBalance.underlyingAmount);

    emit Redeemed(from, to, userBalance.underlyingAmount);
    return userBalance.underlyingAmount;
  }

  function update(uint256 scanLimit) public {
    internalUpdate(false, scanLimit);
  }

  function isCompletedPast(uint32 at) internal view returns (bool) {
    return at <= (_lastUpdateTS / _pointPeriod) * _pointPeriod;
  }

  function getScanRange(uint32 currentPoint, uint256 scanLimit)
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

    maxPoint = _lastKnownPoint;
    if (maxPoint == 0) {
      // shouldn't happen, but as a precaution
      maxPoint = uint32(_lastUpdateTS / _pointPeriod) + _maxDurationPoints + 1;
    }

    // overflow is treated as no-limit
    if (scanLimit > 0 && scanLimit + fromPoint > scanLimit) {
      scanLimit += fromPoint;
      if (scanLimit < maxPoint) {
        maxPoint = uint32(scanLimit);
      }
    }

    if (maxPoint > currentPoint) {
      tillPoint = currentPoint;
    } else {
      tillPoint = maxPoint;
    }

    return (fromPoint, tillPoint, maxPoint);
  }

  function totalOfUnderlying() external view returns (uint256) {
    return _underlyingToken.balanceOf(address(this));
  }

  function internalCurrentTotalSupply() internal view returns (uint256) {
    return _stakedTotal;
  }

  function totalSupply() public view override returns (uint256 totalSupply_) {
    (uint32 fromPoint, uint32 tillPoint, ) =
      getScanRange(uint32(block.timestamp / _pointPeriod), 0);

    totalSupply_ = _stakedTotal;

    console.log('totalSupply', fromPoint, tillPoint, totalSupply_);

    if (tillPoint == 0) {
      return totalSupply_;
    }

    for (; fromPoint <= tillPoint; fromPoint++) {
      uint256 stakeDelta = _pointTotal[fromPoint].stakeDelta;
      if (stakeDelta == 0) {
        continue;
      }
      if (totalSupply_ == stakeDelta) {
        return 0;
      }
      totalSupply_ = totalSupply_.sub(stakeDelta);
    }

    return totalSupply_;
  }

  function internalUpdate(bool preventReentry, uint256 scanLimit)
    internal
    returns (uint32 currentPoint)
  {
    currentPoint = uint32(block.timestamp / _pointPeriod);

    if (_updateEntered) {
      require(!preventReentry, 're-entry to stake or to redeem');
      return currentPoint;
    }
    if (_lastUpdateTS == uint32(block.timestamp)) {
      return currentPoint;
    }

    (uint32 fromPoint, uint32 tillPoint, uint32 maxPoint) = getScanRange(currentPoint, scanLimit);
    if (tillPoint > 0) {
      _updateEntered = true;
      {
        walkPoints(fromPoint, tillPoint, maxPoint);
      }
      _updateEntered = false;
    }

    _lastUpdateTS = uint32(block.timestamp);
    return currentPoint;
  }

  function walkPoints(
    uint32 nextPoint,
    uint32 tillPoint,
    uint32 maxPoint
  ) private {
    Point memory delta = _pointTotal[nextPoint];

    for (; nextPoint <= tillPoint; ) {
      internalCheckpoint(nextPoint * _pointPeriod);

      _extraRate = _extraRate.sub(delta.rateDelta);
      _stakedTotal = _stakedTotal.sub(delta.stakeDelta);

      bool found = false;
      // look for the next non-zero point
      for (nextPoint++; nextPoint <= maxPoint; nextPoint++) {
        delta = _pointTotal[nextPoint];
        if (delta.stakeDelta > 0 || delta.rateDelta > 0) {
          found = true;
          break;
        }
      }
      if (found) {
        continue;
      }

      nextPoint = 0;
      break;
    }

    _nextKnownPoint = nextPoint;
    if (nextPoint == 0 || nextPoint > _lastKnownPoint) {
      _lastKnownPoint = nextPoint;
    }
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

  function internalGetExtraRate() internal view virtual returns (uint256 rate) {
    return _extraRate;
  }

  function internalAddExcess(uint256 amount, uint32 since) internal {
    uint32 at = uint32(block.timestamp);
    uint32 expiry;

    if (since == 0 || since >= at) {
      expiry = 1;
    } else {
      expiry = at - since;
      if (expiry > _maxValuePeriod) {
        expiry = _maxValuePeriod;
      }
    }

    uint32 expiryPt = uint32(expiry + at + _pointPeriod - 1) / _pointPeriod;
    expiry = expiryPt * _pointPeriod;

    // console.log('internalAddExcess', amount, since, _excessAccum);
    // console.log('internalAddExcess_1', expiry, expiryPt, expiry - at);

    expiry -= at;
    amount += _excessAccum;
    uint256 excessRateIncrement = amount / expiry;
    // if (excessRateIncrement < _extraRate>>10) {
    //   excessRateIncrement = 0;
    // }
    _excessAccum = amount - excessRateIncrement * expiry;

    // console.log(
    //   'internalAddExcess_2',
    //   excessRateIncrement,
    //   expiry - block.timestamp,
    //   _excessAccum
    // );

    if (excessRateIncrement == 0) {
      return;
    }

    internalSyncRate(at);

    // console.log(
    //   'internalAddExcess_3',
    //   _extraRate,
    //   _extraRate.add(excessRateIncrement)
    // );

    _extraRate = _extraRate.add(excessRateIncrement);

    excessRateIncrement = excessRateIncrement.add(_pointTotal[expiryPt].rateDelta);
    require(excessRateIncrement <= type(uint128).max);
    _pointTotal[expiryPt].rateDelta = uint128(excessRateIncrement);

    if (_nextKnownPoint > expiryPt || _nextKnownPoint == 0) {
      _nextKnownPoint = expiryPt;
    }

    if (_lastKnownPoint < expiryPt || _lastKnownPoint == 0) {
      _lastKnownPoint = expiryPt;
    }
  }

  function internalSyncRate(uint32 at) internal virtual;

  function internalCheckpoint(uint32 at) internal virtual;

  function unsetStakeBalance(
    address holder,
    uint32 at,
    bool interim
  ) internal virtual;

  function setStakeBalance(address holder, uint224 stakeAmount) internal virtual;

  function getStakeBalance(address holder) internal view virtual returns (uint224 stakeAmount);

  function convertLockedToUnderlying(uint256 lockedAmount, uint32 lockDuration)
    public
    view
    returns (uint256)
  {
    if (lockDuration > _maxValuePeriod) {
      lockDuration = _maxValuePeriod;
    }

    lockDuration = (lockDuration + (_pointPeriod >> 1)) / _pointPeriod;
    lockDuration *= _pointPeriod;

    if (lockDuration < _maxValuePeriod) {
      return lockedAmount.mul(_maxValuePeriod).div(lockDuration);
    }
    return lockedAmount;
  }

  function convertUnderlyingToLocked(uint256 underlyingAmount, uint32 lockDuration)
    public
    view
    returns (uint256 lockedAmount)
  {
    if (lockDuration > _maxValuePeriod) {
      lockDuration = _maxValuePeriod;
    }

    lockDuration = (lockDuration + (_pointPeriod >> 1)) / _pointPeriod;
    lockDuration *= _pointPeriod;

    if (lockDuration < _maxValuePeriod) {
      return underlyingAmount.mul(lockDuration).div(_maxValuePeriod);
    }
    return underlyingAmount;
  }

  function getExtraRate() internal view returns (uint256) {
    return _extraRate;
  }

  function getStakedTotal() internal view returns (uint256) {
    return _stakedTotal;
  }
}
