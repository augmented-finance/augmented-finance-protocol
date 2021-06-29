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

  struct Point {
    uint128 stakeDelta;
    uint128 rateDelta;
  }

  struct ExcessAccum {
    uint128 excessAmount;
    uint64 sinceTotal;
    uint32 sinceCount;
  }

  uint256 private _stakedTotal;
  uint256 private _extraRate;
  ExcessAccum private _excessAccum;
  uint256 private _excessRatio;

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
    uint8 underlyingDecimals,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) public MarketAccessBitmask(accessCtl) {
    _initialize(underlying, underlyingDecimals, pointPeriod, maxValuePeriod);
  }

  function _initialize(
    address underlying,
    uint8 underlyingDecimals,
    uint32 pointPeriod,
    uint32 maxValuePeriod
  ) internal {
    require(pointPeriod > 0, 'invalid pointPeriod');
    require(maxValuePeriod > pointPeriod, 'invalid maxValuePeriod');
    require(maxValuePeriod < pointPeriod * _maxDurationPoints, 'invalid maxValuePeriod');

    _underlyingToken = IERC20(underlying);
    _pointPeriod = pointPeriod;
    _maxValuePeriod = maxValuePeriod;
    _excessRatio = WadRayMath.RAY.div(uint256(10)**underlyingDecimals);
    console.log('_initialize', _excessRatio, underlyingDecimals, uint256(10)**underlyingDecimals);
  }

  function UNDERLYING_ASSET_ADDRESS() external view returns (address) {
    return address(_underlyingToken);
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

    uint32 currentPoint = internalUpdate(true);

    _underlyingToken.safeTransferFrom(from, address(this), underlyingAmount);

    UserBalance memory userBalance = _balances[to];

    {
      uint32 endPoint = uint32(block.timestamp + duration + (_pointPeriod >> 1)) / _pointPeriod;
      require(endPoint <= currentPoint + _maxDurationPoints);

      (stakeAmount, ) = getStakeBalance(to);

      _underlyingTotal = _underlyingTotal.add(underlyingAmount);
      underlyingAmount = underlyingAmount.add(userBalance.underlyingAmount);

      if (userBalance.endPoint > currentPoint) {
        _stakedTotal = _stakedTotal.sub(stakeAmount);
        _pointTotal[userBalance.endPoint].stakeDelta = uint128(
          uint256(_pointTotal[userBalance.endPoint].stakeDelta).sub(stakeAmount)
        );

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

    uint256 totalBefore = _stakedTotal;
    _stakedTotal = totalBefore.add(stakeAmount);
    {
      uint256 stakeDelta = uint256(_pointTotal[userBalance.endPoint].stakeDelta).add(stakeAmount);
      require(stakeDelta <= type(uint128).max);
      _pointTotal[userBalance.endPoint].stakeDelta = uint128(stakeDelta);
    }

    if (_nextKnownPoint > userBalance.endPoint || _nextKnownPoint == 0) {
      _nextKnownPoint = userBalance.endPoint;
    }

    if (_lastKnownPoint < userBalance.endPoint || _lastKnownPoint == 0) {
      _lastKnownPoint = userBalance.endPoint;
    }

    _balances[to] = userBalance;
    internalUpdateTotal(totalBefore, _stakedTotal, uint32(block.timestamp));
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

  function internalBalanceOf(address account)
    internal
    view
    returns (uint256 stakeAmount, uint32 endPointTS)
  {
    (stakeAmount, ) = getStakeBalance(account);
    if (stakeAmount == 0) {
      return (0, 0);
    }

    endPointTS = _balances[account].endPoint * _pointPeriod;
    if (endPointTS <= block.timestamp) {
      return (0, 0);
    }

    return (stakeAmount, endPointTS);

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

  function balanceOf(address account) external view virtual override returns (uint256 stakeAmount) {
    (stakeAmount, ) = internalBalanceOf(account);
    return stakeAmount;
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
    uint32 currentPoint = internalUpdate(true);
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
    internalUpdate(false);
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

    maxPoint = _lastKnownPoint;
    if (maxPoint == 0) {
      // shouldn't happen, but as a precaution
      maxPoint = uint32(_lastUpdateTS / _pointPeriod) + _maxDurationPoints + 1;
    }

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
    (uint32 fromPoint, uint32 tillPoint, ) = getScanRange(uint32(block.timestamp / _pointPeriod));

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

  function internalUpdate(bool preventReentry) internal returns (uint32 currentPoint) {
    currentPoint = uint32(block.timestamp / _pointPeriod);

    if (_updateEntered) {
      require(!preventReentry, 're-entry to stake or to redeem');
      return currentPoint;
    }
    if (_lastUpdateTS == uint32(block.timestamp)) {
      return currentPoint;
    }

    (uint32 fromPoint, uint32 tillPoint, uint32 maxPoint) = getScanRange(currentPoint);

    _updateEntered = true;
    {
      if (tillPoint > 0) {
        walkPoints(fromPoint, tillPoint, maxPoint);
      }

      if (_lastUpdateTS / _pointPeriod < block.timestamp / _pointPeriod) {
        internalApplyExcess();
      }
    }
    _updateEntered = false;

    _lastUpdateTS = uint32(block.timestamp);
    return currentPoint;
  }

  function walkPoints(
    uint32 nextPoint,
    uint32 tillPoint,
    uint32 maxPoint
  ) private {
    uint256 stakedTotal = _stakedTotal;
    uint256 extraRate = _extraRate;

    Point memory delta = _pointTotal[nextPoint];

    for (; nextPoint <= tillPoint; ) {
      if (delta.rateDelta > 0) {
        uint256 rateBefore = extraRate;
        extraRate = extraRate.sub(delta.rateDelta);
        internalExtraRateUpdated(rateBefore, extraRate, nextPoint * _pointPeriod);
      }

      if (delta.stakeDelta > 0) {
        uint256 totalBefore = stakedTotal;
        stakedTotal = stakedTotal.sub(delta.stakeDelta);
        internalUpdateTotal(totalBefore, stakedTotal, nextPoint * _pointPeriod);
      }

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
    _stakedTotal = stakedTotal;
    _extraRate = extraRate;
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

  function internalApplyExcess() private {
    ExcessAccum memory acc = _excessAccum;

    console.log('internalApplyExcess', acc.excessAmount, acc.sinceCount, acc.sinceTotal);
    console.log('internalApplyExcess _excessRatio', _excessRatio);

    if (acc.sinceCount == 0) {
      return;
    }
    _excessAccum.sinceCount = 0;

    if (_excessRatio == 0) {
      return;
    }

    uint32 expiresAt = uint32(acc.sinceTotal / acc.sinceCount);
    if (expiresAt > _maxValuePeriod) {
      expiresAt = _maxValuePeriod;
    }

    console.log('internalApplyExcess expiry', expiresAt);

    expiresAt = uint32(block.timestamp + expiresAt + _pointPeriod - 1) / _pointPeriod;
    console.log('internalApplyExcess expiresAt', expiresAt);

    uint256 excessRateIncrement =
      uint256(acc.excessAmount).mul(_excessRatio) / (expiresAt * _pointPeriod - block.timestamp);
    console.log(
      'internalApplyExcess excessRateIncrement',
      excessRateIncrement,
      uint256(acc.excessAmount).mul(_excessRatio),
      (expiresAt * _pointPeriod - block.timestamp)
    );

    if (excessRateIncrement == 0) {
      return;
    }

    uint256 rateAfter = _extraRate.add(excessRateIncrement);

    console.log('internalApplyExcess_2', _extraRate, excessRateIncrement, expiresAt);

    excessRateIncrement = excessRateIncrement.add(_pointTotal[expiresAt].rateDelta);
    require(excessRateIncrement <= type(uint128).max);
    _pointTotal[expiresAt].rateDelta = uint128(excessRateIncrement);

    if (_nextKnownPoint > expiresAt || _nextKnownPoint == 0) {
      _nextKnownPoint = expiresAt;
    }

    if (_lastKnownPoint < expiresAt || _lastKnownPoint == 0) {
      _lastKnownPoint = expiresAt;
    }

    internalExtraRateUpdated(_extraRate, rateAfter, uint32(block.timestamp));
    _extraRate = rateAfter;
  }

  function internalAddExcess(uint256 amount, uint32 since) internal {
    if (since == 0 || since >= block.timestamp) {
      since = 0;
    } else {
      since = uint32(block.timestamp - since);
    }

    ExcessAccum memory acc = _excessAccum;
    if (acc.sinceCount == 0) {
      acc.sinceCount = 1;
      acc.sinceTotal = since;
    } else {
      amount = amount.add(acc.excessAmount);
      if (since > 0) {
        require(acc.sinceCount < type(uint32).max);
        acc.sinceCount++;
        acc.sinceTotal += since;
      }
    }

    require(amount <= type(uint128).max);
    acc.excessAmount = uint128(amount);
    console.log('internalAddExcess', acc.excessAmount, acc.sinceCount, acc.sinceTotal);

    _excessAccum = acc;
  }

  function internalSetExcessRatio(uint256 excessRatio) internal {
    _excessRatio = excessRatio;
  }

  function internalExtraRateUpdated(
    uint256 rateBefore,
    uint256 rateAfter,
    uint32 at
  ) internal virtual;

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
