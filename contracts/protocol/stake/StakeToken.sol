// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ERC20WithPermit} from '../../misc/ERC20WithPermit.sol';

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IManagedStakeToken} from './interfaces/IStakeToken.sol';
import {ITransferHook} from './interfaces/ITransferHook.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';

import {VersionedInitializable} from '../libraries/aave-upgradeability/VersionedInitializable.sol';
import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

/**
 * @title StakeToken
 * @notice Contract to stake a token for a system reserve.
 **/
abstract contract StakeToken is IManagedStakeToken, VersionedInitializable, ERC20WithPermit {
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private immutable _stakedToken;
  IBalanceHook internal _incentivesController;

  uint256 public immutable COOLDOWN_SECONDS;
  /// @notice Seconds available to redeem once the cooldown period is fullfilled
  uint256 public immutable UNSTAKE_WINDOW;

  mapping(address => uint40) private _stakersCooldowns;

  uint256 private _maxSlashablePercentage;
  bool private _redeemPaused;

  event Staked(address from, address to, uint256 amount);
  event Redeem(address from, address to, uint256 amount, uint256 underlyingAmount);
  event Cooldown(address user, uint40 timestamp);
  event Donated(address from, uint256 amount);
  event Slashed(address to, uint256 amount);

  constructor(
    IERC20 stakedToken,
    IBalanceHook incentivesController,
    uint256 cooldownSeconds,
    uint256 unstakeWindow,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20WithPermit(name, symbol) {
    _stakedToken = stakedToken;
    _incentivesController = incentivesController;
    COOLDOWN_SECONDS = cooldownSeconds;
    UNSTAKE_WINDOW = unstakeWindow;
    super._setupDecimals(decimals);
  }

  /**
   * @dev Called by the proxy contract
   **/
  function initialize(
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external initializer {
    super._initializeDomainSeparator();

    if (getRevision() == 1) {
      super._initializeERC20(name, symbol, decimals);
    }
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_stakedToken);
  }

  function stake(address to, uint256 underlyingAmount) external override returns (uint256) {
    internalStake(msg.sender, to, underlyingAmount);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount
  ) internal returns (uint256 stakeAmount) {
    require(underlyingAmount != 0, 'INVALID_ZERO_AMOUNT');
    uint256 oldReceiverBalance = balanceOf(to);
    stakeAmount = underlyingAmount.percentDiv(exchangeRate());

    _stakersCooldowns[to] = getNextCooldownTimestamp(0, stakeAmount, to, oldReceiverBalance);

    _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);
    _mint(to, stakeAmount);

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleBalanceUpdate(
        to,
        oldReceiverBalance,
        balanceOf(to),
        totalSupply()
      );
    }

    emit Staked(from, to, underlyingAmount);
    return stakeAmount;
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param stakeAmount Amount of stake to redeem
   **/
  function redeem(address to, uint256 stakeAmount)
    external
    override
    returns (uint256 stakeAmount_)
  {
    require(stakeAmount != 0, 'INVALID_ZERO_AMOUNT');
    (stakeAmount_, ) = internalRedeem(msg.sender, to, stakeAmount, 0);
    return stakeAmount_;
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param underlyingAmount Amount of underlying to redeem
   **/
  function redeemUnderlying(address to, uint256 underlyingAmount)
    external
    override
    returns (uint256 underlyingAmount_)
  {
    require(underlyingAmount != 0, 'INVALID_ZERO_AMOUNT');
    (, underlyingAmount_) = internalRedeem(msg.sender, to, 0, underlyingAmount);
    return underlyingAmount_;
  }

  function internalRedeem(
    address from,
    address to,
    uint256 stakeAmount,
    uint256 underlyingAmount
  ) internal returns (uint256, uint256) {
    require(!_redeemPaused, 'redeem paused');

    uint256 cooldownStartTimestamp = _stakersCooldowns[from];
    require(
      block.timestamp > cooldownStartTimestamp.add(COOLDOWN_SECONDS),
      'INSUFFICIENT_COOLDOWN'
    );
    require(
      block.timestamp.sub(cooldownStartTimestamp.add(COOLDOWN_SECONDS)) <= UNSTAKE_WINDOW,
      'UNSTAKE_WINDOW_FINISHED'
    );

    uint256 oldBalance = balanceOf(from);
    if (stakeAmount == 0) {
      stakeAmount = stakeAmount.percentDiv(exchangeRate());

      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
        underlyingAmount = stakeAmount.percentMul(exchangeRate());
      }
    } else {
      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
      }
      underlyingAmount = stakeAmount.percentMul(exchangeRate());
    }

    _burn(from, stakeAmount);

    if (oldBalance == stakeAmount) {
      delete (_stakersCooldowns[from]);
    }

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleBalanceUpdate(from, oldBalance, balanceOf(from), totalSupply());
    }

    IERC20(_stakedToken).safeTransfer(to, underlyingAmount);

    emit Redeem(from, to, stakeAmount, underlyingAmount);
    return (stakeAmount, underlyingAmount);
  }

  /**
   * @dev Activates the cooldown period to unstake
   * - It can't be called if the user is not staking
   **/
  function cooldown() external override {
    require(balanceOf(msg.sender) != 0, 'INVALID_BALANCE_ON_COOLDOWN');

    _stakersCooldowns[msg.sender] = uint40(block.timestamp);
    emit Cooldown(msg.sender, uint40(block.timestamp));
  }

  /**
   * @dev Gets end of the cooldown period.
   * - Returns zero for a not staking user.
   **/
  function getCooldown(address holder) external override returns (uint40) {
    return _stakersCooldowns[holder];
  }

  function exchangeRate() public view override returns (uint256) {
    uint256 total = totalSupply();
    if (total == 0) {
      return PercentageMath.ONE; // 100%
    }
    return _stakedToken.balanceOf(address(this)).percentOf(total);
  }

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external override adminOnly returns (uint256 amount) {
    require(destination != address(0), 'destination is required');

    uint256 balance = _stakedToken.balanceOf(address(this));
    uint256 maxSlashable = balance.percentMul(_maxSlashablePercentage);

    if (maxAmount > maxSlashable) {
      amount = maxSlashable;
    } else {
      amount = maxAmount;
    }
    if (amount < minAmount) {
      return 0;
    }

    _stakedToken.safeTransfer(destination, amount);

    emit Slashed(destination, amount);
    return amount;
  }

  function donate(uint256 amount) external {
    _stakedToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Donated(msg.sender, amount);
  }

  function getMaxSlashablePercentage() external view override returns (uint256) {
    return _maxSlashablePercentage;
  }

  function setMaxSlashablePercentage(uint256 percentageInRay) external override adminOnly {
    require(percentageInRay <= PercentageMath.ONE, 'slashing must not exceed 100%');
    _maxSlashablePercentage = percentageInRay;
  }

  function isRedeemable() external view override returns (bool) {
    return !_redeemPaused;
  }

  function setRedeemable(bool redeemable) external override adminOnly {
    _redeemPaused = !redeemable;
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
    uint256 balanceOfFrom = balanceOf(from);

    // Recipient
    if (from != to) {
      uint256 balanceOfTo = balanceOf(to);

      uint40 previousSenderCooldown = _stakersCooldowns[from];
      _stakersCooldowns[to] = getNextCooldownTimestamp(
        previousSenderCooldown,
        amount,
        to,
        balanceOfTo
      );

      // if cooldown was set and whole balance of sender was transferred - clear cooldown
      if (balanceOfFrom == amount && previousSenderCooldown != 0) {
        delete (_stakersCooldowns[from]);
      }
    }

    super._transfer(from, to, amount);
  }

  /**
   * @dev Calculates the how is gonna be a new cooldown timestamp depending on the sender/receiver situation
   *  - If the timestamp of the sender is "better" or the timestamp of the recipient is 0, we take the one of the recipient
   *  - Weighted average of from/to cooldown timestamps if:
   *    # The sender doesn't have the cooldown activated (timestamp 0).
   *    # The sender timestamp is expired
   *    # The sender has a "worse" timestamp
   *  - If the receiver's cooldown timestamp expired (too old), the next is 0
   * @param fromCooldownTimestamp Cooldown timestamp of the sender
   * @param amountToReceive Amount
   * @param toAddress Address of the recipient
   * @param toBalance Current balance of the receiver
   * @return The new cooldown timestamp
   **/
  function getNextCooldownTimestamp(
    uint40 fromCooldownTimestamp,
    uint256 amountToReceive,
    address toAddress,
    uint256 toBalance
  ) public returns (uint40) {
    uint40 toCooldownTimestamp = _stakersCooldowns[toAddress];
    if (toCooldownTimestamp == 0) {
      return 0;
    }

    uint256 minimalValidCooldownTimestamp =
      block.timestamp.sub(COOLDOWN_SECONDS).sub(UNSTAKE_WINDOW);

    if (minimalValidCooldownTimestamp > toCooldownTimestamp) {
      toCooldownTimestamp = 0;
    } else {
      if (minimalValidCooldownTimestamp > fromCooldownTimestamp) {
        fromCooldownTimestamp = uint40(block.timestamp);
      }

      if (fromCooldownTimestamp < toCooldownTimestamp) {
        return toCooldownTimestamp;
      } else {
        toCooldownTimestamp = uint40(
          (amountToReceive.mul(fromCooldownTimestamp).add(toBalance.mul(toCooldownTimestamp))).div(
            amountToReceive.add(toBalance)
          )
        );
      }
    }
    _stakersCooldowns[toAddress] = toCooldownTimestamp;

    return toCooldownTimestamp;
  }

  modifier adminOnly() {
    //    revert('not implemented');
    _;
  }
}
